#!/usr/bin/env python3
"""T016: protected, read-only Staging Neon PostgreSQL pooled/direct probe.

Only use in an authorized cloudflare-staging GitHub Environment on protected
refs/heads/development. Never print a credential, connection URL, SQL error
payload, libpq stderr, or anything derived from the secret password.
"""
import os
import re
import shutil
import subprocess
from urllib.parse import parse_qs, unquote, urlsplit

REPO = "Vertex-Systems-Network/vsn-builder"
STAGING_HOST = "ep-little-dream-b3g6puj2.c-4.ap-southeast-1.aws.neon.tech"
STAGING_POOLER = STAGING_HOST.replace(".", "-pooler.", 1)
STAGING_PROJECT = "shiny-violet-61219572"
TRUST_ROOT = "/etc/ssl/certs/ca-certificates.crt"
SQL = (
    "BEGIN TRANSACTION READ ONLY; "
    "SELECT current_database(), current_user, "
    "current_setting('transaction_read_only'), pg_is_in_recovery(), "
    "(SELECT count(*) FROM information_schema.tables "
    "WHERE table_schema='public' AND table_type='BASE TABLE'); "
    "COMMIT;"
)


class ProbeBlocked(Exception):
    """Safe diagnostic code only; no private values."""


def inspect_urls(pooled_url, direct_url):
    """Validate exact isolated Neon targets before either secret reaches psql."""
    parsed = []
    for label, raw, exact_host in (
        ("DATABASE_URL", pooled_url, STAGING_POOLER),
        ("DIRECT_URL", direct_url, STAGING_HOST),
    ):
        if not isinstance(raw, str) or not raw or raw != raw.strip():
            raise ProbeBlocked("T016_MISSING_" + label)
        try:
            u = urlsplit(raw)
            host = (u.hostname or "").lower()
            port = u.port
            query = parse_qs(u.query, strict_parsing=True)
        except (ValueError, TypeError):
            raise ProbeBlocked("T016_INVALID_" + label) from None
        if (
            u.scheme not in ("postgresql", "postgres")
            or host != exact_host
            or port not in (None, 5432)
            or not u.username or not u.password
            or not u.path or u.path == "/"
            or u.fragment or query.get("sslmode") != ["require"]
        ):
            raise ProbeBlocked("T016_INVALID_" + label + "_STAGING_IDENTITY")
        parsed.append({
            "host": host, "port": port or 5432,
            "user": unquote(u.username), "password": unquote(u.password),
            "database": unquote(u.path[1:]),
        })
    if (
        parsed[0]["user"] != parsed[1]["user"]
        or parsed[0]["database"] != parsed[1]["database"]
        or pooled_url == direct_url
        or not parsed[0]["database"] or not parsed[0]["user"]
    ):
        raise ProbeBlocked("T016_POOLED_DIRECT_ROLE_OR_DATABASE_MISMATCH")
    return parsed


def inspect_protected_env(env):
    required = {
        "GITHUB_REPOSITORY": REPO,
        "GITHUB_REF": "refs/heads/development",
        "GITHUB_REF_PROTECTED": "true",
        "APP_ENV": "staging",
        "NEON_PROJECT_ID": STAGING_PROJECT,
    }
    if any(env.get(k) != v for k, v in required.items()):
        raise ProbeBlocked("T016_UNPROTECTED_OR_WRONG_STAGING_CONTEXT")


def query_readonly(connection, *, runner=subprocess.run, psql=None, trust_root=TRUST_ROOT):
    """Use libpq verify-full TLS; subprocess argv never includes any secret."""
    binary = psql or shutil.which("psql")
    if not binary or not os.path.isfile(trust_root):
        raise ProbeBlocked("T016_PSQL_OR_SYSTEM_CA_UNAVAILABLE")
    child_env = {
        "PATH": os.environ.get("PATH", ""),
        "HOME": os.environ.get("HOME", "/tmp"),
        "PGHOST": connection["host"],
        "PGPORT": str(connection["port"]),
        "PGUSER": connection["user"],
        "PGPASSWORD": connection["password"],
        "PGDATABASE": connection["database"],
        "PGSSLMODE": "verify-full",
        "PGSSLROOTCERT": trust_root,
        "PGCONNECT_TIMEOUT": "12",
        "PGAPPNAME": "vsn-builder-t016-readonly",
    }
    args = [
        binary, "--no-psqlrc", "--set", "ON_ERROR_STOP=1",
        "--quiet", "--tuples-only", "--no-align", "--field-separator=|",
        "--command", SQL,
    ]
    try:
        result = runner(args, env=child_env, text=True, capture_output=True,
                        timeout=35, check=False)
    except (OSError, subprocess.TimeoutExpired):
        raise ProbeBlocked("T016_POSTGRES_READ_ONLY_CONNECTION_FAILED") from None
    if result.returncode != 0:
        # Do NOT expose libpq's connection-string or password-bearing stderr.
        raise ProbeBlocked("T016_POSTGRES_READ_ONLY_CONNECTION_FAILED")
    parts = (result.stdout or "").strip().split("|")
    if len(parts) != 5:
        raise ProbeBlocked("T016_POSTGRES_RESPONSE_INVALID")
    db, role, tx_read_only, in_recovery, table_count = parts
    if (
        db != connection["database"] or role != connection["user"]
        or tx_read_only != "on" or in_recovery != "f"
        or not re.fullmatch(r"\\d+", table_count)
    ):
        raise ProbeBlocked("T016_POSTGRES_IDENTITY_OR_READ_ONLY_TX_MISMATCH")
    return (db, role, int(table_count))


def main(env=None, *, runner=subprocess.run, psql=None, trust_root=TRUST_ROOT):
    env = os.environ if env is None else env
    inspect_protected_env(env)  # NEVER read credentials on unprotected refs
    urlpair = inspect_urls(env.get("DATABASE_URL"), env.get("DIRECT_URL"))
    results = [
        query_readonly(item, runner=runner, psql=psql, trust_root=trust_root)
        for item in urlpair
    ]
    if results[0] != results[1]:
        raise ProbeBlocked("T016_POOLED_DIRECT_QUERY_IDENTITY_MISMATCH")
    # The physical default may be currently unmigrated. This probe only
    # checks connection, not schema readiness; leave T018/T017 gates intact.
    print(
        "T016 protected Staging Neon authenticated pooled+direct native "
        "PostgreSQL read-only transactions: PASS; libpq TLS verify-full; "
        "same database/role and table-count across both endpoints."
    )
    print("No DDL, Worker deploy, Production access, connection URLs, or secret values.")


if __name__ == "__main__":
    try:
        main()
    except ProbeBlocked as exc:
        print("::error::" + str(exc))
        raise SystemExit(1) from None
