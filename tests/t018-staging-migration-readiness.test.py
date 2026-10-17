import importlib.util
from pathlib import Path
import tempfile
import unittest
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("t018readonly",root/"scripts/t018-staging-migration-readiness.py")
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

def url(host):
    return f"postgresql://neondb_owner:synthetic-no-real-secret@{host}/neondb?sslmode=require"
def stage(**changes):
    base={"GITHUB_REPOSITORY":"Vertex-Systems-Network/vsn-builder",
          "GITHUB_REF":"refs/heads/development","GITHUB_REF_PROTECTED":"true",
          "GITHUB_EVENT_NAME":"push","APP_ENV":"staging",
          "NEON_PROJECT_ID":"shiny-violet-61219572",
          "DATABASE_URL":url(m.t016.STAGING_POOLER),
          "DIRECT_URL":url(m.t016.STAGING_HOST)}
    return {**base,**changes}
def files():
    t=tempfile.TemporaryDirectory(prefix="t018-synthetic-")
    base=Path(t.name)/"prisma/cloud/migrations"
    base.mkdir(parents=True)
    (base/"migration_lock.toml").write_text('provider = "postgresql"\n')
    for name in m.EXPECTED_MIGRATIONS:
        d=base/name
        d.mkdir()
        (d/"migration.sql").write_text("-- synthetic no-operation fixture\n"+("SELECT 1;\n"*8))
    (base.parent/"schema.prisma").write_text("datasource db { provider = \"postgresql\" }")
    return t

class T018(unittest.TestCase):
    def test_two_reviewed_migrations_and_empty_staging_baseline(self):
        with files() as t:
            calls=[]
            def query(c):
                calls.append(c["host"])
                return ("neondb","neondb_owner",0)
            p=m.inspect(stage(),query=query,root=Path(t))
        self.assertEqual(p["migrationFiles"],2)
        self.assertEqual(p["appTablesBeforeMigration"],0)
        self.assertFalse(p["ddlExecuted"])
        self.assertFalse(p["durableRestoreEvidence"])
        self.assertEqual(calls,[m.t016.STAGING_POOLER,m.t016.STAGING_HOST])

    def test_manual_protected_dispatch_keeps_live_zero_table_preflight(self):
        with files() as t:
            calls=[]
            def query(conn):
                calls.append(conn["database"])
                return ("neondb","neondb_owner",0)
            report=m.inspect(stage(GITHUB_EVENT_NAME="workflow_dispatch"),
                             query=query,root=Path(t))
            self.assertTrue(report["ready"])
            self.assertEqual(calls,["neondb","neondb"])

    def test_wrong_branch_project_hostname_or_production_stops_before_db_access(self):
        with files() as t:
            for update in [
              {"GITHUB_REF":"refs/heads/main"},
              {"GITHUB_REF_PROTECTED":"false"},
              {"GITHUB_REPOSITORY":"attacker/fork"},
              {"GITHUB_EVENT_NAME":"pull_request"},
              {"APP_ENV":"production"},
              {"NEON_PROJECT_ID":"nameless-violet-68750490"},
              {"DATABASE_URL":url(m.t016.STAGING_HOST)},
              {"DIRECT_URL":url(m.t016.STAGING_POOLER)},
              {"DIRECT_URL":"postgresql://neondb_owner:pwd@localhost/neondb?sslmode=require"},
              {"DATABASE_URL":url(m.t016.STAGING_POOLER).replace("/neondb?","/brovexa?"),
               "DIRECT_URL":url(m.t016.STAGING_HOST).replace("/neondb?","/brovexa?")},
            ]:
                with self.subTest(update=tuple(update)):
                    with self.assertRaisesRegex(m.Blocked,"T018_STAGING_READ_ONLY_BASELINE_UNVERIFIED"):
                        m.inspect(stage(**update),query=lambda c:self.fail("DB must not be called"),root=Path(t))

    def test_dirty_staging_db_or_mismatched_hosts_cannot_pass(self):
        with files() as t:
            for values in [
              iter([("neondb","neondb_owner",1),("neondb","neondb_owner",1)]),
              iter([("neondb","neondb_owner",0),("neondb","wrong_role",0)]),
              iter([("different","neondb_owner",0),("different","neondb_owner",0)]),
            ]:
                with self.assertRaises(m.Blocked):
                    m.inspect(stage(),query=lambda c:next(values),root=Path(t))

    def test_missing_migration_or_wrong_provider_fails_before_live_query(self):
        with files() as t:
            base=Path(t)/"prisma/cloud/migrations"
            (base/m.EXPECTED_MIGRATIONS[1]/"migration.sql").unlink()
            with self.assertRaises(m.Blocked):
                m.inspect(stage(),root=Path(t),query=lambda c:self.fail("no SQL"))
        with files() as t:
            base=Path(t)/"prisma/cloud/migrations"
            (base/"migration_lock.toml").write_text('provider = "sqlite"')
            with self.assertRaises(m.Blocked):
                m.inspect(stage(),root=Path(t),query=lambda c:self.fail("no SQL"))

if __name__=="__main__":
    unittest.main()
