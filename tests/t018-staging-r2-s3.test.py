"""T018 source-only real SigV4 shape + no-secret S3 recovery adversarial tests."""
import datetime
import hashlib
import importlib.util
import urllib.parse
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
def load(path,name):
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
m=load(ROOT/"scripts/t018-staging-private-r2-s3.py","t018_s3")
legacy=load(ROOT/"tests/t018-staging-private-r2-backup.test.py","t018_old_tests")
def env(**kwargs):
    return {**legacy.env(),
      "CLOUDFLARE_R2_CONTROL_PLANE_TOKEN":"synthetic-token-for-private-r2-tests-only",
      "CLOUDFLARE_R2_ACCESS_KEY_ID":"SYNTHETICACCESSKEY0000000000000",
      "CLOUDFLARE_R2_SECRET_ACCESS_KEY":"synthetic-secret-key-for-tests-000000000000",
      **kwargs}

class S3Sim:
    def __init__(self,mutate_download=False):
        self.control=legacy.Sim()
        self.calls=[]
        self.objects={}
        self.mutate_download=mutate_download
    def control_fetch(self,request):
        return self.control.fetch(request)
    def s3_fetch(self,request):
        url=request.full_url
        assert url.startswith(m.S3),url
        assert "synthetic-secret" not in url
        auth=request.get_header("Authorization")
        assert auth.startswith("AWS4-HMAC-SHA256 Credential=SYNTHETICACCESSKEY")
        assert "SignedHeaders=" in auth and "Signature=" in auth
        assert request.get_header("X-amz-date")
        assert request.get_header("X-amz-content-sha256")
        method=request.get_method()
        key=urllib.parse.unquote(url[len(m.S3):])
        self.calls.append((method,key,request))
        assert m.OBJECT_KEY.fullmatch(key)
        if method=="GET":
            if key not in self.objects:return 404,b""
            if self.mutate_download:return 200,b"modified-retained-backup"
            return 200,self.objects[key]
        if method=="PUT":
            assert request.get_header("If-none-match")=="*"
            if key in self.objects:return 412,b"untrusted body"
            assert request.get_header("X-amz-content-sha256")==hashlib.sha256(request.data).hexdigest()
            self.objects[key]=request.data
            return 200,b""
        raise AssertionError("unexpected S3 verb")

class S3Backup(unittest.TestCase):
    def test_source_only_real_signer_canonical_scheme_and_atomic_header(self):
        key="t018/pre-migration/"+"a"*40+"/38988888777-1.pgcustom"
        fake_time=datetime.datetime(2026,10,17,12,5,6,tzinfo=datetime.timezone.utc)
        req=m.sign_request("PUT",key,"SYNTHETICACCESSKEY0000000000000",
                           "synthetic-secret-key-for-tests-000000000000",
                           b"sample"*100,now=fake_time)
        self.assertEqual(req.full_url,m.S3+key)
        self.assertEqual(req.get_header("X-amz-date"),"20261017T120506Z")
        self.assertEqual(req.get_header("If-none-match"),"*")
        self.assertIn("/20261017/auto/s3/aws4_request",req.get_header("Authorization"))
        self.assertIn("SignedHeaders=host;if-none-match;x-amz-content-sha256;x-amz-date",
                      req.get_header("Authorization"))
        self.assertNotIn("synthetic-secret",req.full_url)
        self.assertNotIn("synthetic-secret",req.get_header("Authorization"))
        with self.assertRaises(m.base.Blocked):
            m.sign_request("DELETE",key,"x"*32,"a"*64)
        with self.assertRaises(m.base.Blocked):
            m.sign_request("PUT","../production.pgcustom","x"*32,"a"*64,b"0"*300)

    def test_private_scoped_r2_durable_checksum_and_disposable_restore(self):
        sim=S3Sim()
        proof=m.backup(env(),runner=sim.control.docker,
                       control=sim.control_fetch,s3=sim.s3_fetch)
        self.assertTrue(proof["ready"])
        self.assertTrue(proof["private_control_plane_verified"])
        self.assertTrue(proof["s3_bucket_scoped_readback_verified"])
        self.assertTrue(proof["disposable_pg18_restore_verified"])
        self.assertFalse(proof["remote_neon_writes"])
        self.assertEqual([v[0] for v in sim.calls],["GET","PUT","GET"])
        self.assertEqual(len(sim.objects),1)
        self.assertEqual(len(sim.control.calls),3)
        self.assertNotIn("synthetic-secret",str(proof))
        with self.assertRaises(m.base.Blocked) as captured:
            m.backup(env(),runner=sim.control.docker,
                     control=sim.control_fetch,s3=sim.s3_fetch)
        self.assertIn("BACKUP_KEY_ALREADY_USED",str(captured.exception))
        self.assertEqual(sum(x[0]=="PUT" for x in sim.calls),1)

    def test_wrong_scope_or_secrets_fail_before_provider_traffic(self):
        cases=[
            {"CLOUDFLARE_R2_ACCESS_KEY_ID":""},
            {"CLOUDFLARE_R2_SECRET_ACCESS_KEY":""},
            {"CLOUDFLARE_R2_CONTROL_PLANE_TOKEN":""},
            {"GITHUB_REF_PROTECTED":"false"},
            {"GITHUB_REF":"refs/heads/main"},
            {"APP_ENV":"production"},
            {"NEON_PROJECT_ID":"nameless-violet-68750490"},
            {"DIRECT_URL":legacy.conn(m.pg.EXPECTED_DIRECT).replace("/neondb?","/brovexa?"),
             "DATABASE_URL":legacy.conn(m.pg.EXPECTED_POOL).replace("/neondb?","/brovexa?")},
            {"CLOUDFLARE_ACCOUNT_ID":"0"*32},
            {"GITHUB_SHA":"bogus"},
        ]
        for case in cases:
            with self.subTest(case=tuple(case)):
                sim=S3Sim()
                with self.assertRaises(m.base.Blocked):
                    m.backup(env(**case),runner=sim.control.docker,
                             control=sim.control_fetch,s3=sim.s3_fetch)
                self.assertEqual(sim.control.calls,[])
                self.assertEqual(sim.calls,[])

    def test_public_domain_denied_before_neon_and_s3(self):
        for case in ({"domain_public":True},
                     {"custom_domains":[{"domain":"public.example.com"}]}):
            sim=S3Sim()
            sim.control=legacy.Sim(**case)
            with self.assertRaises(m.base.Blocked):
                m.backup(env(),runner=lambda *a,**kw:self.fail("No Neon allowed"),
                         control=sim.control_fetch,s3=sim.s3_fetch)
            self.assertEqual(sim.calls,[])

    def test_corrupt_r2_readback_rejected_before_restore_acceptance(self):
        sim=S3Sim(mutate_download=True)
        with self.assertRaises(m.base.Blocked) as exc:
            m.backup(env(),runner=sim.control.docker,
                     control=sim.control_fetch,s3=sim.s3_fetch)
        self.assertIn("S3_PERSISTED_HASH_MISMATCH",str(exc.exception))
        self.assertEqual(len(sim.objects),1)

    def test_atomic_s3_collision_412_does_not_overwrite(self):
        sim=S3Sim()
        key="t018/pre-migration/"+"a"*40+"/38988888777-1.pgcustom"
        sim.objects[key]=b"original"
        req=m.sign_request("PUT",key,env()["CLOUDFLARE_R2_ACCESS_KEY_ID"],
                           env()["CLOUDFLARE_R2_SECRET_ACCESS_KEY"],b"new"*100)
        status,_=sim.s3_fetch(req)
        self.assertEqual(status,412)
        self.assertEqual(sim.objects[key],b"original")

if __name__=="__main__": unittest.main()
