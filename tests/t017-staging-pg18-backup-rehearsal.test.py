"""No-cloud/no-Neon synthetic tests for the real protected Postgres18 rehearsal."""
import importlib.util
from pathlib import Path
import unittest

source=Path(__file__).resolve().parents[1]/"scripts/t017-staging-pg18-backup-rehearsal.py"
spec=importlib.util.spec_from_file_location("t017pg18",source)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
def url(host,db="neondb",user="neondb_owner",sslmode="require"):
    return f"postgresql://{user}:synthetic-not-real@{host}/{db}?sslmode={sslmode}"
def env(**kw):
    x={
      "GITHUB_REPOSITORY":m.EXPECTED_REPO,
      "GITHUB_REF":"refs/heads/development",
      "GITHUB_REF_PROTECTED":"true",
      "GITHUB_EVENT_NAME":"push",
      "APP_ENV":"staging",
      "NEON_PROJECT_ID":m.EXPECTED_PROJECT,
      "DATABASE_URL":url(m.EXPECTED_POOL),
      "DIRECT_URL":url(m.EXPECTED_DIRECT),
    }
    return {**x,**kw}

class Result:
    def __init__(self,stdout="",returncode=0,stderr=""):
        self.stdout=stdout
        self.returncode=returncode
        self.stderr=stderr

class Contract(unittest.TestCase):
    def test_protected_branch_before_any_url(self):
        for k,v in [
            ("GITHUB_REF","refs/heads/main"),("GITHUB_REF_PROTECTED","false"),
            ("GITHUB_REPOSITORY","untrusted/fork"),("GITHUB_EVENT_NAME","pull_request"),
            ("APP_ENV","production"),("NEON_PROJECT_ID","nameless-violet-68750490"),
        ]:
            with self.subTest(k=k),self.assertRaises(m.Blocked):
                m.rehearse(env(**{k:v}),runner=lambda *a,**kw:self.fail("unexpected Docker"))

    def test_reject_wrong_host_ssl_role_database_and_non_postgres(self):
        base=env()
        for change in [
            {"DATABASE_URL":url(m.EXPECTED_DIRECT)},
            {"DIRECT_URL":url(m.EXPECTED_POOL)},
            {"DATABASE_URL":url("ep-jolly-truth-b3xbibzp.c-4.ap-southeast-1.aws.neon.tech")},
            {"DIRECT_URL":url(m.EXPECTED_DIRECT,sslmode="disable")},
            {"DIRECT_URL":url(m.EXPECTED_DIRECT,db="other")},
            {"DIRECT_URL":url(m.EXPECTED_DIRECT,user="other")},
            {"DIRECT_URL":"https://bad.example"},
            {"DIRECT_URL":""},
        ]:
            with self.subTest(change=tuple(change)),self.assertRaises(m.Blocked):
                m.check_neon_urls({**base,**change})

    def test_source_and_disposable_local_host_are_isolated(self):
        direct=m.check_neon_urls(env())
        remote,env1=m.docker_command(["pg_dump","--format=custom","--file=/t017/staging.dump"],direct,mount="/tmp/test-folder")
        local,env2=m.docker_command(["pg_restore","--dbname="+m.LOCAL_DB,"/t017/staging.dump"],direct,local=True,mount="/tmp/test-folder")
        self.assertEqual(env1["PGHOST"],m.EXPECTED_DIRECT)
        self.assertEqual(env1["PGSSLMODE"],"verify-full")
        self.assertEqual(env2["PGHOST"],"127.0.0.1")
        self.assertEqual(env2["PGDATABASE"],m.LOCAL_DB)
        self.assertEqual(env2["PGSSLMODE"],"disable")
        self.assertIn("postgres:18",remote)
        self.assertIn("postgres:18",local)
        self.assertIn(",readonly",next(x for x in local if x.startswith("type=bind")))
        self.assertNotIn(",readonly",next(x for x in remote if x.startswith("type=bind")))
        for args in [remote,local]:
            self.assertNotIn("synthetic-not-real"," ".join(args))
            self.assertNotIn("postgresql://"," ".join(args))
            self.assertNotIn(m.LOCAL_PASSWORD," ".join(args))
        self.assertIn("BEGIN TRANSACTION READ ONLY",m.SQL)

    def test_all_actual_docker_steps_prove_temporary_dump_restored_without_secret_echo(self):
        calls=[]
        def fake(argv,**kwargs):
            calls.append((argv,kwargs))
            if "pg_dump" in argv:
                mount=next(x for x in argv if x.startswith("type=bind"))
                folder=mount.split("src=",1)[1].split(",dst=",1)[0]
                (Path(folder)/"staging.dump").write_bytes(b"synthetic-only"*25)
            if "psql" in argv:
                local=kwargs["env"]["PGHOST"]=="127.0.0.1"
                db=m.LOCAL_DB if local else "neondb"
                return Result(f"{db}|0|1\n")
            return Result()
        info=m.rehearse(env(),runner=fake)
        self.assertTrue(info["ready"])
        self.assertFalse(info["persistent_backup_created"])
        self.assertFalse(info["remote_sql_writes"])
        self.assertFalse(info["production_touched"])
        self.assertEqual(sum("pg_dump" in x[0] for x in calls),1)
        self.assertEqual(sum("pg_restore" in x[0] for x in calls),1)
        self.assertEqual(sum("psql" in x[0] for x in calls),2)
        for args,kw in calls:
            self.assertNotIn("synthetic-not-real"," ".join(args))
            self.assertNotIn("postgresql://"," ".join(args))

    def test_failed_restore_and_wrong_shape_block_without_leaking_credentials(self):
        def fail(argv,**kw):
            return Result("",1,"postgresql://SECRET invalid auth")
        with self.assertRaises(m.Blocked) as caught:
            m.rehearse(env(),runner=fail)
        self.assertNotIn("SECRET",str(caught.exception))
        self.assertEqual(str(caught.exception),"T017_SOURCE_QUERY_FAILED")
        self.assertNotIn("postgresql://",str(caught.exception))
        self.assertNotIn("synthetic-not-real",str(caught.exception))

if __name__=="__main__":
    unittest.main()
