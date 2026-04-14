#!/usr/bin/env python3
"""
verify_import.py — Verify that the VillageAPI database import completed correctly.

Connects to DATABASE_URL, counts rows in each geography table, and prints
3 random villages with their full hierarchy.

Exit code 1 if Village count = 0.
"""

import os
import sys
from pathlib import Path

try:
    import psycopg2
except ImportError:
    print("❌ psycopg2 is not installed. Run: pip install -r scripts/requirements.txt")
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    print("❌ python-dotenv is not installed. Run: pip install -r scripts/requirements.txt")
    sys.exit(1)

ROOT = Path(__file__).parent.parent


def get_connection():
    """Load .env and connect to DATABASE_URL."""
    env_root = ROOT / ".env"
    env_api = ROOT / "api" / ".env"

    if env_root.exists():
        load_dotenv(env_root)
    elif env_api.exists():
        load_dotenv(env_api)
    else:
        load_dotenv()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("❌ DATABASE_URL not found in environment or .env file")
        sys.exit(1)

    try:
        conn = psycopg2.connect(database_url)
        return conn
    except psycopg2.Error as e:
        print(f"❌ Database connection failed: {e}")
        sys.exit(1)


def main():
    conn = get_connection()
    cur = conn.cursor()

    print()
    print("═" * 60)
    print("  VillageAPI — Import Verification")
    print("═" * 60)

    # ─── Row Counts ──────────────────────────────────────────
    tables = ["Country", "State", "District", "SubDistrict", "Village"]
    counts = {}

    print()
    print(f"  {'Table':<20} {'Count':>12}")
    print(f"  {'─' * 20} {'─' * 12}")

    for table in tables:
        cur.execute(f'SELECT COUNT(*) FROM "{table}"')
        count = cur.fetchone()[0]
        counts[table] = count
        print(f"  {table:<20} {count:>12,}")

    print()

    # ─── 3 Random Villages with Full Hierarchy ───────────────
    print("─" * 60)
    print("  Sample Villages (3 random)")
    print("─" * 60)

    cur.execute("""
        SELECT
            v.name     AS village_name,
            v.code     AS village_code,
            sd.name    AS subdistrict,
            d.name     AS district,
            s.name     AS state,
            c.name     AS country
        FROM "Village" v
        JOIN "SubDistrict" sd ON v."subDistrictId" = sd.id
        JOIN "District"    d  ON sd."districtId"   = d.id
        JOIN "State"       s  ON d."stateId"       = s.id
        JOIN "Country"     c  ON s."countryId"     = c.id
        ORDER BY RANDOM()
        LIMIT 3
    """)

    rows = cur.fetchall()

    if rows:
        for i, (v_name, v_code, sd, dist, state, country) in enumerate(rows, 1):
            print(f"\n  [{i}] {country} > {state} > {dist} > {sd} > {v_name}")
            print(f"      Code: {v_code}")
    else:
        print("\n  ⚠️  No villages found in the database!")

    print()
    print("═" * 60)

    # ─── Final Verdict ───────────────────────────────────────
    village_count = counts.get("Village", 0)
    if village_count == 0:
        print("  ❌ FAILED — Village count is 0")
        print("     Run the import first: python scripts/import_villages.py")
        print("═" * 60)
        cur.close()
        conn.close()
        sys.exit(1)
    else:
        print(f"  ✅ PASSED — {village_count:,} villages loaded successfully")
        print("═" * 60)

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
