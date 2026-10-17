#!/usr/bin/env python3
"""T018: durable private Cloudflare R2 backup and isolated Staging restore proof.

Protected-development / cloudflare-staging only. Read Neon Staging without DDL,
upload a bounded PostgreSQL custom dump to the private Builder-only R2 bucket,
read it back, and restore that downloaded copy into disposable PostgreSQL 18.
NEVER deploy a Worker, alter the remote database, install an app or log secrets.
"""
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

T017=Path(__file__).resolve().with_name("t017-staging-pg18-backup-rehearsal.py")
_spec=importlib.util.spec_from_file_location("t017_safe_rehearsal",T017)
pg=importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pg)

ACCOUNT="f63cf3af0868a5c8a0b26ebee5dd039f"
BUCKET="vsn-builder-staging-backups"
API=f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/r2/buckets/{BUCKET}"
MAX_BYTES=10*1024*1024  # Empty, verified pre-migration Staging schema only.
CODE="T018_STAGING_DURABLE_R2_BACKUP_UNVERIFIED"

class Blocked(Exception):
    pass

def fail(stage):
    return Blocked("T018_"+stage+"_BLOCKED")

def validate(env):
    # Ref/context checks precede parsing secrets and ALL network requests.
    pg.check_context(env)
    if env.get("CLOUDFLARE_ACCOUNT_ID","").lower()!=ACCOUNT:
        raise fail("CLOUDFLARE_ACCOUNT")
    if not isinstance(env.get("CLOUDFLARE_R2_API_TOKEN"),str) or len(env["CLOUDFLARE_R2_API_TOKEN"])<12:
        raise fail("CLOUDFLARE_SCOPED_TOKEN")
    sha=env.get("GITHUB_SHA","")
    run_id=env.get("GITHUB_RUN_ID","")
    attempt=env.get("GITHUB_RUN_ATTEMPT","")
    if not re.fullmatch("[0-9a-f]{40}",sha) or not re.fullmatch("[0-9]{4,20}",run_id) or not re.fullmatch("[0-9]{1,3}",attempt):
        raise fail("PROTECTED_RUN_IDENTITY")
    try:
        direct=pg.check_neon_urls(env)
    except Exception:
        raise fail("NEON_TARGET")
    # Immutable per protected run attempt. No shared or Live bucket.
    key=f"t018/pre-migration/{sha}/{run_id}-{attempt}.pgcustom"
    return direct,key

def default_transport(request):
    try:
        with urllib.request.urlopen(request,timeout=25) as result:
            value=result.read(MAX_BYTES+1)
            if len(value)>MAX_BYTES:raise fail("PROVIDER_RESPONSE_LIMIT")
            return int(result.status),value
    except urllib.error.HTTPError as exc:
        # Never echo provider URL, response or auth header.
        return int(exc.code),b""
    except (urllib.error.URLError,TimeoutError,OSError):
        raise fail("PROVIDER_REQUEST") from None

def request(transport,token,suffix,method="GET",body=None,expect_binary=False):
    if (suffix and not suffix.startswith("/")) or "://" in suffix or ".." in suffix:
        raise fail("R2_PATH")
    headers={"Authorization":"Bearer "+token,"Accept":"application/json"}
    if body is not None:headers["Content-Type"]="application/octet-stream"
    http=urllib.request.Request(API+suffix,data=body,headers=headers,method=method)
    status,payload=transport(http)
    if not 200<=status<300 or len(payload)>MAX_BYTES:
        # The resource category and HTTP code are SAFE diagnostics: never
        # print request URLs, provider body, bearer token or account secrets.
        stage=(
            "BUCKET" if suffix=="" else
            "MANAGED_DOMAIN" if suffix=="/domains/managed" else
            "CUSTOM_DOMAINS" if suffix=="/domains/custom" else
            "PRIVATE_OBJECT" if suffix.startswith("/objects/") else "UNKNOWN"
        )
        code=str(status) if 400<=status<=599 else "INVALID"
        raise fail("R2_"+stage+"_"+method+"_HTTP_"+code)
    if expect_binary:return payload
    try:
        doc=json.loads(payload.decode("utf8"))
        if doc.get("success") is not True:raise fail("R2_"+method+"_BODY")
        return doc.get("result")
    except (ValueError,UnicodeDecodeError,AttributeError):
        raise fail("R2_"+method+"_BODY") from None

def assert_private_bucket(transport,token):
    info=request(transport,token,"")
    public=request(transport,token,"/domains/managed")
    domains=request(transport,token,"/domains/custom")
    items=domains.get("domains") if isinstance(domains,dict) else domains
    if (not isinstance(info,dict) or info.get("name")!=BUCKET or
        not isinstance(public,dict) or public.get("enabled") is not False or
        not isinstance(items,list) or len(items)!=0):
        raise fail("R2_BUCKET_PUBLIC_OR_WRONG")
    return True

def backup(env,runner=subprocess.run,transport=default_transport):
    direct,key=validate(env)
    token=env["CLOUDFLARE_R2_API_TOKEN"]
    assert_private_bucket(transport,token)
    # Fail closed if original Builder default unexpectedly contains merchant data.
    # Real Staging default currently has 0 user tables and is pre-migration ONLY.
    source=pg.read_fingerprint(runner,direct)
    if source!=(0,1):
        raise fail("SOURCE_NOT_EMPTY_BASELINE")
    object_path="/objects/"+urllib.parse.quote(key,safe="/")
    # Prevent accidental overwrite of a previous protected recovery checkpoint.
    prior=urllib.request.Request(API+object_path,headers={
        "Authorization":"Bearer "+token,"Accept":"application/octet-stream"
    },method="GET")
    state,existing=transport(prior)
    if state!=404:
        raise fail("BACKUP_KEY_ALREADY_USED_OR_UNVERIFIED")
    with tempfile.TemporaryDirectory(prefix="vsn-builder-t018-") as dirname:
        archive=Path(dirname)/"recovery.pgcustom"
        cmd,pg_env=pg.docker_command([
            "pg_dump","--format=custom","--no-owner","--no-acl",
            "--file=/t017/recovery.pgcustom"],direct,mount=dirname)
        pg.run_safe(runner,cmd,pg_env,timeout=180,stage="DURABLE_DUMP")
        if not archive.is_file() or not 256<=archive.stat().st_size<=MAX_BYTES:
            raise fail("ARCHIVE_SIZE")
        data=archive.read_bytes()
        original_hash=hashlib.sha256(data).digest()
        # Encrypted-at-rest Cloudflare R2 private bucket; HTTPS bearer API only.
        request(transport,token,object_path,method="PUT",body=data)
        # Verify retained bytes by downloading from R2 (not from local dump).
        raw=request(transport,token,object_path,expect_binary=True)
        if not raw or hashlib.sha256(raw).digest()!=original_hash:
            raise fail("PERSISTED_HASH_MISMATCH")
        archive.write_bytes(raw)
        # RESTORED bytes are specifically R2-readback contents.
        cmd,local_env=pg.docker_command([
            "pg_restore","--exit-on-error","--no-owner","--no-acl",
            "--dbname="+pg.LOCAL_DB,"/t017/recovery.pgcustom"
        ],direct,local=True,mount=dirname)
        pg.run_safe(runner,cmd,local_env,timeout=120,stage="DISPOSABLE_R2_RESTORE")
        restored=pg.read_fingerprint(runner,direct,local=True)
        if restored!=source:
            raise fail("SCHEMA_ROUNDTRIP_MISMATCH")
    # Proof identifies a retained R2 private object by nonsecret path ONLY.
    return {"ready":True,"project":pg.EXPECTED_PROJECT,"bucket":BUCKET,
            "object_key":key,"source_table_count":source[0],
            "restored_table_count":restored[0],"remote_neon_writes":False,
            "staging_migration_executed":False,"production_touched":False,
            "private_r2_readback_verified":True}

if __name__=="__main__":
    try:
        proof=backup(os.environ)
        print("T018 protected private R2 backup and isolated PostgreSQL 18 restore: PASS")
        print("Private object key: "+proof["object_key"])
        print("Neon Staging was read-only; no migration or Production changes.")
    except Blocked as e:
        print("::error::"+str(e))
        raise SystemExit(1) from None
    except Exception:
        print("::error::"+CODE)
        raise SystemExit(1) from None
