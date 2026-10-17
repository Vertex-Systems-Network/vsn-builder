#!/usr/bin/env python3
"""T017: real protected Staging Postgres 18 backup/restore REHEARSAL, no Neon writes.

Back up the current Builder Staging primary into a temporary per-run custom
pg_dump archive, restore into a DISPOSABLE local PostgreSQL 18 CI container,
and compare schema/table shape. No backup uploads, no remote DDL, no Neon
branch/snapshot operations, no Live/Production access or secret logging.
"""
import os
import re
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import unquote, urlsplit, parse_qs

EXPECTED_REPO="Vertex-Systems-Network/vsn-builder"
EXPECTED_PROJECT="shiny-violet-61219572"
EXPECTED_DIRECT="ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech"
EXPECTED_POOL=EXPECTED_DIRECT.replace(".","-pooler.",1)
LOCAL_DB="vsn_builder_t017_rehearsal"
LOCAL_PASSWORD="synthetic-ci-postgres-rehearsal-only"
DOCKER_IMAGE="postgres:18"
SAFE_CODE="T017_STAGING_PG18_BACKUP_RESTORE_UNVERIFIED"
SQL=("BEGIN TRANSACTION READ ONLY; "
     "SELECT current_database(),"
     "(SELECT COUNT(*) FROM pg_catalog.pg_class c "
     "JOIN pg_catalog.pg_namespace n ON c.relnamespace=n.oid "
     "WHERE c.relkind IN ('r','p') AND n.nspname NOT LIKE 'pg_%' "
     "AND n.nspname <> 'information_schema'),"
     "(SELECT COUNT(*) FROM pg_catalog.pg_namespace "
     "WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'); "
     "COMMIT;")

class Blocked(Exception):
    pass

def check_context(env):
    for key,value in {
        "GITHUB_REPOSITORY":EXPECTED_REPO,
        "GITHUB_REF":"refs/heads/development",
        "GITHUB_REF_PROTECTED":"true",
        "GITHUB_EVENT_NAME":"push",
        "APP_ENV":"staging",
        "NEON_PROJECT_ID":EXPECTED_PROJECT,
    }.items():
        if env.get(key)!=value:raise Blocked(SAFE_CODE)

def validate_url(raw,expected_host):
    try:
        if not raw or raw!=raw.strip():raise Blocked(SAFE_CODE)
        x=urlsplit(raw)
        if (x.scheme not in ("postgresql","postgres") or
            (x.hostname or "").lower()!=expected_host or
            x.port not in (None,5432) or not x.username or
            not x.password or not x.path or x.path=="/" or x.fragment):
            raise Blocked(SAFE_CODE)
        query=parse_qs(x.query,strict_parsing=True)
        if query.get("sslmode")!=["require"]:raise Blocked(SAFE_CODE)
        return {
            "host":expected_host,"user":unquote(x.username),
            "password":unquote(x.password),"db":unquote(x.path[1:]),
        }
    except (ValueError, TypeError):
        raise Blocked(SAFE_CODE) from None

def check_neon_urls(env):
    # Strictly verify BOTH actual Stage GitHub-scoped URLs and same role/db.
    direct=validate_url(env.get("DIRECT_URL"),EXPECTED_DIRECT)
    pooled=validate_url(env.get("DATABASE_URL"),EXPECTED_POOL)
    if direct["user"]!=pooled["user"] or direct["db"]!=pooled["db"]:
        raise Blocked(SAFE_CODE)
    return direct

def docker_pg_env(connection,local=False):
    # docker -e PGPASSWORD passes env without ever placing the password in argv.
    context={
        "PATH":os.environ.get("PATH","/usr/bin:/bin"),
        "HOME":os.environ.get("HOME","/tmp"),
        "PGHOST":"127.0.0.1" if local else connection["host"],
        "PGPORT":"5432","PGUSER":"postgres" if local else connection["user"],
        "PGPASSWORD":LOCAL_PASSWORD if local else connection["password"],
        "PGDATABASE":LOCAL_DB if local else connection["db"],
        "PGSSLMODE":"disable" if local else "verify-full",
        "PGCONNECT_TIMEOUT":"12",
    }
    if not local:
        context["PGSSLROOTCERT"]="/etc/ssl/certs/ca-certificates.crt"
    return context

def docker_command(argv, connection, local=False, mount=None):
    # Fixed Postgres 18 image matches the provider's live 18.x major version.
    env=docker_pg_env(connection,local)
    # Temp dump directory is mode 0700: run container as its OWNER,
    # never weaken archive permissions or restore privileged DAC overrides.
    cmd=["docker","run","--rm","--network","host",
         "--user",f"{os.getuid()}:{os.getgid()}",
         "--cap-drop","ALL","--security-opt","no-new-privileges",
         "--read-only","--tmpfs","/tmp:rw,nosuid,noexec,size=64m"]
    if not local:
        # Mount GitHub runner trusted CA bundle. Docker postgres:18 image may
        # ship a different CA path; never silently relax verify-full TLS.
        cmd+=["--mount",("type=bind,src=/etc/ssl/certs/ca-certificates.crt,"
                         "dst=/etc/ssl/certs/ca-certificates.crt,readonly")]
    if mount:
        mode="" if argv[0]=="pg_dump" else ",readonly"
        cmd+=["--mount",f"type=bind,src={mount},dst=/t017{mode}"]
    for key in env:
        if key.startswith("PG"):cmd+=["--env",key]
    cmd+=[DOCKER_IMAGE,*argv]
    return cmd,env

def run_safe(runner,cmd,env,timeout=90,stage="DOCKER"):
    try:
        proc=runner(cmd,env=env,text=True,capture_output=True,timeout=timeout,
                    check=False)
        if proc.returncode!=0:raise Blocked("T017_"+stage+"_FAILED")
        return proc.stdout or ""
    except (OSError,subprocess.TimeoutExpired):
        raise Blocked("T017_"+stage+"_FAILED") from None

def read_fingerprint(runner,connection,local=False):
    cmd,env=docker_command(["psql","--no-psqlrc","-X","--quiet",
                            "--tuples-only","--no-align",
                            "--field-separator=|",
                            "--set","ON_ERROR_STOP=1","--command",SQL],
                           connection,local=local)
    text=run_safe(runner,cmd,env,stage="LOCAL_RESTORE_QUERY" if local else "SOURCE_QUERY")
    rows=[line.strip().split("|") for line in text.splitlines()
          if "|" in line]
    if len(rows)!=1 or len(rows[0])!=3:raise Blocked("T017_LOCAL_SHAPE_FAILED" if local else "T017_SOURCE_SHAPE_FAILED")
    db,tables,schemas=rows[0]
    wanted=LOCAL_DB if local else connection["db"]
    if db!=wanted or not re.fullmatch(r"\d+",tables) or not re.fullmatch(r"\d+",schemas):
        raise Blocked("T017_LOCAL_SHAPE_FAILED" if local else "T017_SOURCE_SHAPE_FAILED")
    return int(tables),int(schemas)

def rehearse(env,runner=subprocess.run):
    check_context(env)  # no source secrets used before this check
    direct=check_neon_urls(env)
    source_counts=read_fingerprint(runner,direct)
    with tempfile.TemporaryDirectory(prefix="vsn-builder-t017-") as folder:
        # pg_dump uses only the read-only DIRECT Neon connection; no DDL.
        cmd,dumpenv=docker_command(
            ["pg_dump","--format=custom","--no-owner","--no-acl",
             "--file=/t017/staging.dump"],
            direct,mount=folder)
        run_safe(runner,cmd,dumpenv,timeout=180,stage="DUMP")
        archive=Path(folder)/"staging.dump"
        if not archive.is_file() or archive.stat().st_size<256:
            raise Blocked("T017_BACKUP_ARCHIVE_MISSING")
        cmd,restoreenv=docker_command(
            ["pg_restore","--exit-on-error","--no-owner","--no-acl",
             "--dbname="+LOCAL_DB,"/t017/staging.dump"],
            direct,local=True,mount=folder)
        run_safe(runner,cmd,restoreenv,timeout=120,stage="LOCAL_RESTORE")
        target_counts=read_fingerprint(runner,direct,local=True)
    if source_counts!=target_counts:
        raise Blocked("T017_SCHEMA_ROUNDTRIP_MISMATCH")
    # Never print credentials, raw database dump, schema names or response bodies.
    return {"ready":True,"toolchain":"postgres:18",
            "source":EXPECTED_PROJECT,"local_restore":"ephemeral-only",
            "tables_match":True,"schemas_match":True,
            "remote_sql_writes":False,"production_touched":False,
            "persistent_backup_created":False}

if __name__=="__main__":
    try:
        evidence=rehearse(os.environ)
        print("T017 real protected Staging PostgreSQL 18 dump and isolated restore: PASS")
        print("Restored schema/table shape matched. No Neon writes or Production access.")
        print("Ephemeral dump securely discarded; durable backup/snapshot not certified.")
    except Blocked as exc:
        print("::error::"+str(exc))
        raise SystemExit(1) from None
    except Exception:
        print("::error::"+SAFE_CODE)
        raise SystemExit(1) from None
