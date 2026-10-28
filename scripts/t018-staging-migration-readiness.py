#!/usr/bin/env python3
"""Protected T018 Staging migration baseline PRECHECK ONLY. Never executes DDL."""
import importlib.util
import os
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
T016=ROOT/"scripts/t016-staging-neon-connectivity.py"
spec=importlib.util.spec_from_file_location("vsn_t016_readonly",T016)
t016=importlib.util.module_from_spec(spec)
spec.loader.exec_module(t016)

ERROR="T018_STAGING_READ_ONLY_BASELINE_UNVERIFIED"
EXPECTED_DB="neondb"
EXPECTED_MIGRATIONS=(
 "20261013_builder_cloud_baseline",
 "20261013_builder_shop_installation_fence",
)

class Blocked(Exception):
    pass

def inspect(env,query=None,root=ROOT):
    try:
        # No connection/credential processing until exact protected Builder ref.
        t016.inspect_protected_env(env)
        if env.get("GITHUB_EVENT_NAME") not in ("push","workflow_dispatch"):
            raise Blocked(ERROR)
        pair=t016.inspect_urls(env.get("DATABASE_URL"),env.get("DIRECT_URL"))
        if pair[0]["database"]!="neondb" or pair[1]["database"]!="neondb":
            raise Blocked(ERROR)
        migration_root=Path(root)/"prisma/cloud/migrations"
        names=tuple(sorted(p.name for p in migration_root.iterdir()
                           if p.is_dir() and (p/"migration.sql").is_file()))
        if names!=EXPECTED_MIGRATIONS:
            raise Blocked(ERROR)
        for name in names:
            if (migration_root/name/"migration.sql").stat().st_size<50:
                raise Blocked(ERROR)
        lock=(migration_root/"migration_lock.toml").read_text()
        if 'provider = "postgresql"' not in lock:
            raise Blocked(ERROR)
        if not (Path(root)/"prisma/cloud/schema.prisma").is_file():
            raise Blocked(ERROR)
        query=query or t016.query_readonly
        pooled=query(pair[0])
        direct=query(pair[1])
        if pooled!=direct or pooled[0]!=EXPECTED_DB or pooled[2]!=0:
            raise Blocked(ERROR)
        return {"ready":True,"tier":"staging","migrationFiles":len(names),
                "appTablesBeforeMigration":0,"neonWrites":False,
                "durableRestoreEvidence":False,"ddlExecuted":False,
                "productionTouched":False}
    except Exception:
        raise Blocked(ERROR) from None

if __name__=="__main__":
    try:
        info=inspect(os.environ)
        print("T018 protected Staging READ ONLY migration baseline: PASS")
        print("Existing Staging pooled/direct PostgreSQL agree; reviewed 2 Prisma cloud migrations; 0 app tables.")
        print("No DDL, durable backup claim, store installation, Worker deployment or Production mutation.")
    except Blocked as error:
        print("::error::"+str(error))
        raise SystemExit(1) from None
