"""T016 synthetic policy tests: no network and no real credentials."""
import importlib.util
import os
from pathlib import Path
import unittest

SOURCE = Path(__file__).resolve().parents[1] / "scripts/t016-staging-neon-connectivity.py"
spec = importlib.util.spec_from_file_location("t016_staging_neon", SOURCE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def url(host, database="neondb", user="neondb_owner"):
    return f"postgresql://{user}:synthetic-not-real@{host}/{database}?sslmode=require"

class FakeResult:
    def __init__(self, text, code=0, stderr=""):
        self.returncode = code
        self.stdout = text
        self.stderr = stderr

class T016Test(unittest.TestCase):
    def setUp(self):
        self.pooled = url(mod.STAGING_POOLER)
        self.direct = url(mod.STAGING_HOST)
        self.env = {
            "GITHUB_REPOSITORY": mod.REPO,
            "GITHUB_REF": "refs/heads/development",
            "GITHUB_REF_PROTECTED": "true",
            "APP_ENV": "staging",
            "NEON_PROJECT_ID": mod.STAGING_PROJECT,
            "DATABASE_URL": self.pooled,
            "DIRECT_URL": self.direct,
        }
    def test_correct_staging_identity_and_pooled_direct_pair(self):
        p, d = mod.inspect_urls(self.pooled, self.direct)
        self.assertEqual(p["host"], mod.STAGING_POOLER)
        self.assertEqual(d["host"], mod.STAGING_HOST)
        self.assertEqual(p["database"], d["database"])
        self.assertEqual(p["user"], d["user"])
        mod.inspect_protected_env(self.env)
    def test_reject_cross_tier_and_direct_instead_of_pooler(self):
        for runtime, direct in [
            (self.direct, self.direct),
            (url("ep-jolly-truth-b3xbibzp.c-4.ap-southeast-1.aws.neon.tech"), self.direct),
            (self.pooled, url(mod.STAGING_POOLER)),
            (self.pooled, url(mod.STAGING_HOST, database="other")),
            (self.pooled, url(mod.STAGING_HOST, user="other")),
            (self.pooled.replace("sslmode=require", "sslmode=disable"), self.direct),
            (self.pooled.replace("postgresql://", "http://"), self.direct),
        ]:
            with self.subTest(runtime=runtime[:9], direct=direct[:9]):
                with self.assertRaises(mod.ProbeBlocked):
                    mod.inspect_urls(runtime, direct)
    def test_unprotected_refs_reject_before_reading_secrets(self):
        for k, value in [
            ("GITHUB_REF_PROTECTED", "false"),
            ("GITHUB_REF", "refs/heads/main"),
            ("GITHUB_REPOSITORY", "untrusted/fork"),
            ("APP_ENV", "production"),
            ("NEON_PROJECT_ID", "nameless-violet-68750490"),
        ]:
            env = {**self.env, k: value}
            with self.assertRaisesRegex(mod.ProbeBlocked, "T016_UNPROTECTED"):
                mod.main(env, runner=lambda *a, **kw: self.fail("unexpected SQL"))
    def test_native_query_uses_verify_full_readonly_and_never_puts_password_in_argv(self):
        calls = []
        def fake_run(args, **kwargs):
            calls.append((args, kwargs))
            return FakeResult("neondb|neondb_owner|on|f|0\n")
        mod.main(self.env, runner=fake_run, psql="/usr/bin/psql")
        self.assertEqual(len(calls), 2)
        self.assertEqual([c[1]["env"]["PGHOST"] for c in calls],
                         [mod.STAGING_POOLER, mod.STAGING_HOST])
        for args, kw in calls:
            self.assertEqual(kw["env"]["PGSSLMODE"], "verify-full")
            self.assertEqual(kw["env"]["PGSSLROOTCERT"], mod.TRUST_ROOT)
            self.assertEqual(kw["env"]["PGPASSWORD"], "synthetic-not-real")
            self.assertNotIn("synthetic-not-real", " ".join(args))
            self.assertIn("BEGIN TRANSACTION READ ONLY", " ".join(args))
            self.assertNotIn("DATABASE_URL", kw["env"])
    def test_real_connection_failure_does_not_leak_stderr(self):
        def fake_run(*args, **kwargs):
            return FakeResult("", 2, "SECRET! postgresql://name:SECRET@host")
        with self.assertRaises(mod.ProbeBlocked) as caught:
            mod.main(self.env, runner=fake_run, psql="/usr/bin/psql")
        self.assertNotIn("SECRET", str(caught.exception))
    def test_mismatched_or_non_readonly_query_results_fail(self):
        for output in ["neondb|wrong|on|f|0\n",
                       "neondb|neondb_owner|off|f|0\n",
                       "neondb|neondb_owner|on|f|bad\n",
                       "neondb|neondb_owner|on|t|0\n"]:
            with self.assertRaises(mod.ProbeBlocked):
                mod.main(self.env, runner=lambda *a, **kw: FakeResult(output),
                         psql="/usr/bin/psql")


    def test_prisma_migration_query_override_is_rejected_by_readonly_precheck(self):
        base = self.pooled
        malformed = [
            "&schema=untrusted", "&options=-c%20search_path%3Duntrusted",
            "&host=untrusted.example", "&hostaddr=127.0.0.1",
            "&service=alternate", "&sslrootcert=%2Ftmp%2Ffake",
            "&sslmode=require", "&channel_binding=disable",
            "&application_name=bad%0Avalue", "&application_name=",
            "&connect_timeout=0", "&connect_timeout=100",
            "&pgbouncer=false", "&connection_limit=999",
            "&pool_timeout=999", "&unknown=1",
        ]
        for suffix in malformed:
            with self.subTest(suffix=suffix):
                with self.assertRaises(mod.ProbeBlocked):
                    mod.inspect_urls(base + suffix, self.direct)
                with self.assertRaises(mod.ProbeBlocked):
                    mod.inspect_urls(self.pooled, self.direct + suffix)
        p, d = mod.inspect_urls(
            self.pooled + "&channel_binding=require&application_name=vsn_t018&pgbouncer=true&connection_limit=4",
            self.direct + "&channel_binding=require&connect_timeout=12",
        )
        self.assertEqual(p["database"], "neondb")
        self.assertEqual(d["database"], "neondb")
        with self.assertRaises(mod.ProbeBlocked):
            mod.inspect_urls(self.pooled, self.direct + "&pgbouncer=true")

if __name__ == "__main__":
    unittest.main()
