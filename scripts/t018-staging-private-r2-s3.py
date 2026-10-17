#!/usr/bin/env python3
"""T018 bucket-scoped R2 S3 SigV4 durable recovery, Staging only.

Object credentials can access only the dedicated backup bucket. Independently
verify public-domain restrictions with a separate Cloudflare control-plane
credential BEFORE any database read or S3 upload. Fail closed on missing proofs.
No remote DDL, Shopify installation, Worker deployment or Production access.
"""
import datetime
import hashlib
import hmac
import importlib.util
import os
import re
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE=Path(__file__).with_name("t018-staging-private-r2-backup.py")
_spec=importlib.util.spec_from_file_location("t018_control_plane",BASE)
base=importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(base)
pg=base.pg
HOST=f"{base.ACCOUNT}.r2.cloudflarestorage.com"
S3=f"https://{HOST}/{base.BUCKET}/"
OBJECT_KEY=re.compile(r"t018/pre-migration/[0-9a-f]{40}/[0-9]{4,20}-[0-9]{1,3}\.pgcustom\Z")
ERROR="T018_PRIVATE_S3_BACKUP_UNVERIFIED"

class NeverRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        return None

def s3_transport(req):
    # Never forward S3 signed headers to another host on HTTP redirects.
    try:
        with urllib.request.build_opener(NeverRedirect()).open(req,timeout=30) as resp:
            data=resp.read(base.MAX_BYTES+1)
            if len(data)>base.MAX_BYTES:raise base.fail("S3_RESPONSE_LIMIT")
            return int(resp.status),data
    except urllib.error.HTTPError as exc:
        return int(exc.code),b""
    except (urllib.error.URLError,TimeoutError,OSError):
        raise base.fail("S3_NETWORK") from None

def checked_credentials(env):
    # Validate the repo/tier/Neon host+DB, protected ref, exact run ID,
    # and privileged metadata-audit secret BEFORE making any network call.
    try:
        pg.check_context(env)
    except Exception:
        raise base.fail("PROTECTED_REF_OR_TIER") from None
    if env.get("CLOUDFLARE_ACCOUNT_ID","").lower()!=base.ACCOUNT:
        raise base.fail("CLOUDFLARE_ACCOUNT")
    # Safe categorical diagnostics: distinguish absent Environment secrets
    # from wrong Neon identity without printing values, lengths or URLs.
    control=env.get("CLOUDFLARE_R2_CONTROL_PLANE_TOKEN")
    if not isinstance(control,str) or len(control)<12:
        raise base.fail("R2_CONTROL_PLANE_CREDENTIAL")
    access=env.get("CLOUDFLARE_R2_ACCESS_KEY_ID")
    secret=env.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
    if not all(isinstance(v,str) and
               16<=len(v)<=128 and
               re.fullmatch(r"[A-Za-z0-9+/=_-]+",v)
               for v in (access,secret)):
        raise base.fail("S3_BUCKET_SCOPED_CREDENTIALS")
    try:
        direct,key=base.validate(env,token_name="CLOUDFLARE_R2_CONTROL_PLANE_TOKEN")
    except Exception:
        raise base.fail("NEON_OR_PROTECTED_RUN_IDENTITY") from None
    if not OBJECT_KEY.fullmatch(key):
        raise base.fail("S3_OBJECT_KEY")
    return direct,key,access,secret

def sign_request(method,key,access,secret,data=None,now=None):
    if method not in ("GET","PUT") or not OBJECT_KEY.fullmatch(key):
        raise base.fail("S3_METHOD_OR_KEY")
    if method=="PUT" and (not isinstance(data,bytes) or
                           not 256<=len(data)<=base.MAX_BYTES):
        raise base.fail("S3_UPLOAD_SIZE")
    if method=="GET" and data is not None:
        raise base.fail("S3_GET_BODY")
    now=now or datetime.datetime.now(datetime.timezone.utc)
    stamp=now.strftime("%Y%m%dT%H%M%SZ")
    day=stamp[:8]
    path="/"+base.BUCKET+"/"+urllib.parse.quote(key,safe="/-_.~")
    body=data if method=="PUT" else b""
    payload_hash=hashlib.sha256(body).hexdigest()
    signed={
        "host":HOST,
        "x-amz-content-sha256":payload_hash,
        "x-amz-date":stamp,
    }
    if method=="PUT":
        # R2 atomically rejects concurrent creation/overwriting of a key.
        signed["if-none-match"]="*"
    keys=sorted(signed)
    headers_str="".join(k+":"+signed[k]+"\n" for k in keys)
    signed_names=";".join(keys)
    canonical="\n".join([method,path,"",headers_str,signed_names,payload_hash])
    scope=f"{day}/auto/s3/aws4_request"
    to_sign="\n".join(["AWS4-HMAC-SHA256",stamp,scope,
                       hashlib.sha256(canonical.encode("utf8")).hexdigest()])
    def mac(key_bytes,message):
        return hmac.new(key_bytes,message.encode("utf8"),hashlib.sha256).digest()
    signing_key=mac(mac(mac(mac(("AWS4"+secret).encode("utf8"),day),
                        "auto"),"s3"),"aws4_request")
    signature=hmac.new(signing_key,to_sign.encode("utf8"),hashlib.sha256).hexdigest()
    signed["Authorization"]=(f"AWS4-HMAC-SHA256 Credential={access}/{scope}, "
                              f"SignedHeaders={signed_names}, Signature={signature}")
    if method=="PUT":
        signed["Content-Type"]="application/octet-stream"
    return urllib.request.Request("https://"+HOST+path,
                                  data=data,headers=signed,method=method)

def object_request(transport,method,key,access,secret,data=None):
    status,payload=transport(sign_request(method,key,access,secret,data=data))
    if method=="GET" and status==404:
        return 404,b""
    if not 200<=status<300 or len(payload)>base.MAX_BYTES:
        code=str(status) if 400<=status<=599 else "INVALID"
        raise base.fail(f"S3_OBJECT_{method}_HTTP_{code}")
    return status,payload

def backup(env,runner=subprocess.run,s3=s3_transport,control=base.default_transport):
    direct,key,access,secret=checked_credentials(env)
    # The S3 object token cannot attest public-domain state. Use a SEPARATE
    # Cloudflare REST control-plane credential for the private-bucket checks.
    # A bucket-scoped R2 Object token must NOT be sent to api.cloudflare.com.
    base.assert_private_bucket(control,env["CLOUDFLARE_R2_CONTROL_PLANE_TOKEN"])
    if pg.read_fingerprint(runner,direct)!=(0,1):
        raise base.fail("SOURCE_NOT_EMPTY_BASELINE")
    # A negative read is not a write barrier. The PUT below also includes
    # atomic If-None-Match: *, so a competing job cannot replace an archive.
    status,_=object_request(s3,"GET",key,access,secret)
    if status!=404:
        raise base.fail("BACKUP_KEY_ALREADY_USED_OR_UNVERIFIED")
    with tempfile.TemporaryDirectory(prefix="vsn-builder-t018-s3-") as folder:
        archive=Path(folder)/"recovery.pgcustom"
        cmd,pg_env=pg.docker_command(
            ["pg_dump","--format=custom","--no-owner","--no-acl",
             "--file=/t017/recovery.pgcustom"],direct,mount=folder)
        pg.run_safe(runner,cmd,pg_env,timeout=180,stage="S3_DURABLE_DUMP")
        if not archive.is_file() or not 256<=archive.stat().st_size<=base.MAX_BYTES:
            raise base.fail("S3_ARCHIVE_SIZE")
        dump=archive.read_bytes()
        expected=hashlib.sha256(dump).digest()
        object_request(s3,"PUT",key,access,secret,data=dump)
        _,remote=object_request(s3,"GET",key,access,secret)
        if not remote or hashlib.sha256(remote).digest()!=expected:
            raise base.fail("S3_PERSISTED_HASH_MISMATCH")
        archive.write_bytes(remote)
        cmd,local_env=pg.docker_command(
            ["pg_restore","--exit-on-error","--no-owner","--no-acl",
             "--dbname="+pg.LOCAL_DB,"/t017/recovery.pgcustom"],
            direct,local=True,mount=folder)
        pg.run_safe(runner,cmd,local_env,timeout=120,stage="S3_DISPOSABLE_RESTORE")
        if pg.read_fingerprint(runner,direct,local=True)!=(0,1):
            raise base.fail("S3_RESTORE_SHAPE_MISMATCH")
    return {"ready":True,"bucket":base.BUCKET,"object_key":key,
            "private_control_plane_verified":True,
            "s3_bucket_scoped_readback_verified":True,
            "disposable_pg18_restore_verified":True,
            "remote_neon_writes":False,
            "staging_migration_executed":False,"production_touched":False}

if __name__=="__main__":
    try:
        proof=backup(os.environ)
        print("T018 private bucket-scoped S3 backup and disposable PostgreSQL 18 restore: PASS")
        print("Retained private object key: "+proof["object_key"])
        print("Neon Staging read-only, no migration, Production untouched.")
    except base.Blocked as exc:
        print("::error::"+str(exc))
        raise SystemExit(1) from None
    except Exception:
        print("::error::"+ERROR)
        raise SystemExit(1) from None
