"""T018 synthetic no-secret tests for private R2 recovery from verified Staging."""
import importlib.util
import json
from pathlib import Path
import unittest
import urllib.parse

source=Path(__file__).resolve().parents[1]/"scripts/t018-staging-private-r2-backup.py"
spec=importlib.util.spec_from_file_location("t018_r2_backup",source)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
def conn(host):
    return f"postgresql://synthetic_user:synthetic_pw@{host}/neondb?sslmode=require"
def env(**kw):
    o={"GITHUB_REPOSITORY":"Vertex-Systems-Network/vsn-builder",
    "GITHUB_REF":"refs/heads/development","GITHUB_REF_PROTECTED":"true",
    "GITHUB_EVENT_NAME":"push","APP_ENV":"staging",
    "NEON_PROJECT_ID":"shiny-violet-61219572",
    "DATABASE_URL":conn(m.pg.EXPECTED_POOL),
    "DIRECT_URL":conn(m.pg.EXPECTED_DIRECT),
    "CLOUDFLARE_ACCOUNT_ID":m.ACCOUNT,
    "CLOUDFLARE_R2_API_TOKEN":"synthetic-token-for-private-r2-tests-only",
    "GITHUB_SHA":"a"*40,"GITHUB_RUN_ID":"38988888777",
    "GITHUB_RUN_ATTEMPT":"1"}
    return {**o,**kw}
class Result:
    def __init__(self,text=""):
        self.returncode=0
        self.stdout=text

class Sim:
    def __init__(self,domain_public=False,custom_domains=None,bad_digest=False):
        self.calls=[];self.saved={};self.domain_public=domain_public
        self.custom_domains=custom_domains or []
        self.bad_digest=bad_digest
    def fetch(self,request):
        url=request.full_url
        method=request.get_method()
        self.calls.append((method,url,request))
        assert url.startswith(m.API),url
        assert request.get_header("Authorization")=="Bearer synthetic-token-for-private-r2-tests-only"
        path=url[len(m.API):]
        if path=="":payload={"name":m.BUCKET}
        elif path=="/domains/managed":payload={"enabled":self.domain_public}
        elif path=="/domains/custom":payload={"domains":self.custom_domains}
        elif path.startswith("/objects/"):
            if method=="PUT":
                self.saved[path]=request.data
                payload={"key":path,"size":len(request.data)}
            elif path not in self.saved:return 404,b""
            elif self.bad_digest:return 200,b"bad-digest"
            else:return 200,self.saved[path]
        else:raise AssertionError("wrong R2 route: "+path)
        return 200,json.dumps({"success":True,"result":payload}).encode("utf8")
    def docker(self,args,**kwargs):
        if "pg_dump" in args:
            mount=next(x for x in args if x.startswith("type=bind") and "dst=/t017" in x)
            folder=mount.split("src=",1)[1].split(",dst=",1)[0]
            (Path(folder)/"recovery.pgcustom").write_bytes(b"safe synthetic dump only"*42)
        if "psql" in args:
            database=m.pg.LOCAL_DB if kwargs["env"]["PGHOST"]=="127.0.0.1" else "neondb"
            return Result(database+"|0|1\n")
        return Result()

class R2Backup(unittest.TestCase):
    def test_realistic_private_R2_durable_readback_and_disposable_restore(self):
        sim=Sim()
        result=m.backup(env(),runner=sim.docker,transport=sim.fetch)
        self.assertTrue(result["ready"])
        self.assertTrue(result["private_r2_readback_verified"])
        self.assertFalse(result["staging_migration_executed"])
        self.assertFalse(result["remote_neon_writes"])
        self.assertFalse(result["production_touched"])
        self.assertEqual(result["source_table_count"],0)
        self.assertEqual(result["restored_table_count"],0)
        self.assertEqual(len(sim.saved),1)
        methods=[p[0] for p in sim.calls]
        self.assertEqual(methods.count("PUT"),1)
        self.assertEqual(methods.count("GET"),5)
        for method,url,request in sim.calls:
            self.assertNotIn("synthetic_pw",url)
            self.assertNotIn("postgresql://",url)
        self.assertNotIn("synthetic-token",str(result))

    def test_forks_unprotected_wrong_neon_and_fake_run_never_reach_provider(self):
        for values in [
         {"GITHUB_REPOSITORY":"attacker/repo"},
         {"GITHUB_REF_PROTECTED":"false"},
         {"GITHUB_REF":"refs/heads/main"},
         {"GITHUB_EVENT_NAME":"pull_request"},
         {"APP_ENV":"production"},
         {"NEON_PROJECT_ID":"nameless-violet-68750490"},
         {"DIRECT_URL":conn("ep-fake.c-4.ap-southeast-1.aws.neon.tech")},
         # Both URLs may point to the correct branch and role but to a
         # different database: this must fail BEFORE the R2 API is called.
         {"DIRECT_URL":conn(m.pg.EXPECTED_DIRECT).replace("/neondb?","/brovexa?"),
          "DATABASE_URL":conn(m.pg.EXPECTED_POOL).replace("/neondb?","/brovexa?")},
         {"DATABASE_URL":conn(m.pg.EXPECTED_DIRECT)},
         {"CLOUDFLARE_ACCOUNT_ID":"a"*32},
         {"CLOUDFLARE_R2_API_TOKEN":""},
         {"CLOUDFLARE_R2_API_TOKEN":None},
         {"GITHUB_SHA":"unsigned"},
         {"GITHUB_RUN_ID":"0"},
        ]:
            sim=Sim()
            with self.subTest(key=tuple(values)),self.assertRaises(Exception):
                m.backup(env(**values),runner=sim.docker,transport=sim.fetch)
            self.assertFalse(sim.calls)

    def test_worker_cloudflare_token_cannot_replace_dedicated_R2_token(self):
        sim=Sim()
        state=env(CLOUDFLARE_R2_API_TOKEN="")
        state["CLOUDFLARE_API_TOKEN"]="synthetic-worker-token-irrelevant"
        with self.assertRaises(m.Blocked):
            m.backup(state,runner=sim.docker,transport=sim.fetch)
        self.assertFalse(sim.calls)

    def test_public_bucket_and_shared_bucket_domains_block_BEFORE_dump_or_upload(self):
        for setting in [{"domain_public":True},{"custom_domains":[{"domain":"open.example.org"}]}]:
            sim=Sim(**setting)
            with self.assertRaises(m.Blocked):
                m.backup(env(),runner=lambda *a,**kw:self.fail("No Neon read until private R2 verified"),transport=sim.fetch)
            self.assertEqual(len(sim.saved),0)

    def test_missing_remote_readback_or_modified_digest_fails_closed(self):
        sim=Sim(bad_digest=True)
        with self.assertRaises(m.Blocked) as ctx:
            m.backup(env(),runner=sim.docker,transport=sim.fetch)
        self.assertIn("PERSISTED_HASH_MISMATCH",str(ctx.exception))
        self.assertEqual(len(sim.saved),1)

    def test_key_collision_never_overwrites_prior_r2_backup(self):
        sim=Sim()
        first=m.backup(env(),runner=sim.docker,transport=sim.fetch)
        self.assertTrue(first["ready"])
        with self.assertRaises(m.Blocked):
            m.backup(env(),runner=sim.docker,transport=sim.fetch)
        self.assertEqual(sum(x[0]=="PUT" for x in sim.calls),1)

    def test_http_denial_names_only_resource_and_status_never_token(self):
        for resource,status in [
            ("",403),("/domains/managed",404),("/domains/custom",401),
        ]:
            sim=Sim()
            original=sim.fetch
            def denied(req):
                path=req.full_url[len(m.API):]
                if path==resource:
                    sim.calls.append((req.get_method(),req.full_url,req))
                    return status,b"UNTRUSTED PROVIDER BODY SECRET"
                return original(req)
            with self.subTest(resource=resource,status=status):
                with self.assertRaises(m.Blocked) as captured:
                    m.backup(env(),runner=sim.docker,transport=denied)
                expected=(
                    "BUCKET" if resource=="" else
                    "MANAGED_DOMAIN" if resource=="/domains/managed" else
                    "CUSTOM_DOMAINS"
                )
                self.assertIn(f"R2_{expected}_GET_HTTP_{status}",str(captured.exception))
                self.assertNotIn("SECRET",str(captured.exception))
                self.assertNotIn("synthetic-token",str(captured.exception))
                self.assertEqual(len(sim.saved),0)

    def test_unexpected_user_tables_blocks_new_backup(self):
        sim=Sim()
        def changed(args,**kwargs):
            if "psql" in args:return Result("neondb|1|1\n")
            return sim.docker(args,**kwargs)
        with self.assertRaises(m.Blocked) as ctx:
            m.backup(env(),runner=changed,transport=sim.fetch)
        self.assertIn("SOURCE_NOT_EMPTY_BASELINE",str(ctx.exception))
        self.assertEqual(len(sim.saved),0)

if __name__=="__main__":unittest.main()
