#!/usr/bin/env python3
"""
import_villages.py -- Import village-level geography data into VillageAPI database.
Uses batch inserts throughout to minimize round-trips to remote NeonDB.

Usage:
    python scripts/import_villages.py                           # default CSV dataset
    python scripts/import_villages.py path/to/file.csv          # override path
"""

import sys
import os
import io
import time
import logging
from pathlib import Path
from datetime import datetime

# --- Dependency checks --------------------------------------------------------
try:
    import pyarrow.parquet as pq
except ImportError:
    print("[ERROR] pyarrow not installed. Run: pip install -r scripts/requirements.txt")
    sys.exit(1)

import pandas as pd

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("[ERROR] psycopg2 not installed. Run: pip install -r scripts/requirements.txt")
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    print("[ERROR] python-dotenv not installed. Run: pip install -r scripts/requirements.txt")
    sys.exit(1)

# --- Paths --------------------------------------------------------------------
ROOT = Path(__file__).parent.parent
DEFAULT_FILE = ROOT / "public" / "all_india_villages.csv"
LOG_FILE = Path(__file__).parent / "import.log"

# --- Logging (ASCII-safe for Windows) -----------------------------------------
logger = logging.getLogger("village_import")
logger.setLevel(logging.INFO)

fmt = logging.Formatter("%(message)s")
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(fmt)
if sys.platform == "win32":
    console_handler.stream = io.TextIOWrapper(
        sys.stdout.buffer, encoding="utf-8", errors="replace"
    )
logger.addHandler(console_handler)

file_handler = logging.FileHandler(LOG_FILE, mode="w", encoding="utf-8")
file_handler.setFormatter(
    logging.Formatter("%(asctime)s  %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
)
logger.addHandler(file_handler)

# --- Column Aliases -----------------------------------------------------------
COLUMN_ALIASES = {
    "state_code":       ["MDDS STC", "state_code", "stc", "state_cd", "State_Code"],
    "state_name":       ["STATE NAME", "state_name", "state", "State_Name"],
    "district_code":    ["MDDS DTC", "district_code", "dtc", "dist_cd", "District_Code"],
    "district_name":    ["DISTRICT NAME", "district_name", "district", "District_Name"],
    "subdistrict_code": ["MDDS Sub_DT", "subdistrict_code", "sub_dt", "SubDistrict_Code"],
    "subdistrict_name": ["SUB-DISTRICT NAME", "subdistrict_name", "sub_district", "block", "SubDistrict_Name"],
    "village_code":     ["MDDS PLCN", "village_code", "plcn", "lgd_code", "Village_Code", "Unique_ID"],
    "village_name":     ["Area Name", "AREA NAME", "village_name", "area_name", "village", "Village_Name"],
}

REQUIRED_CANONICAL = ["state_name", "district_name", "subdistrict_name", "village_name"]
BATCH_SIZE = 5000
COUNTRY_NAME = "India"
COUNTRY_CODE = "IN"

# --- Helpers ------------------------------------------------------------------

def resolve_columns(df):
    actual_cols = set(df.columns)
    mapping = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        found = None
        for alias in aliases:
            if alias in actual_cols:
                found = alias
                break
        mapping[canonical] = found
    return mapping


def read_file(filepath):
    suffix = filepath.suffix.lower()
    if suffix == ".parquet":
        logger.info(f"[READ] Parquet: {filepath}")
        return pq.read_table(filepath).to_pandas()
    elif suffix in (".xlsx", ".xls"):
        logger.info(f"[READ] Excel: {filepath}")
        return pd.read_excel(filepath)
    elif suffix == ".csv":
        logger.info(f"[READ] CSV: {filepath}")
        return pd.read_csv(filepath)
    else:
        logger.error(f"[ERROR] Unsupported format: {suffix}")
        sys.exit(1)


def clean_dataframe(df, col_map):
    for canonical, actual in col_map.items():
        if actual and actual in df.columns:
            df[actual] = df[actual].astype(str).str.strip()

    name_col = col_map["village_name"]
    sd_col = col_map["subdistrict_name"]
    dist_col = col_map["district_name"]
    state_col = col_map["state_name"]

    before = len(df)
    required_actuals = [col_map[c] for c in REQUIRED_CANONICAL if col_map[c]]
    df = df.dropna(subset=required_actuals)
    df = df[~df[required_actuals].isin(["", "nan", "None"]).any(axis=1)]

    if name_col and sd_col:
        mask_sd = df[name_col].str.upper() == df[sd_col].str.upper()
        mask_dist = df[name_col].str.upper() == df[dist_col].str.upper() if dist_col else pd.Series(False, index=df.index)
        mask_state = df[name_col].str.upper() == df[state_col].str.upper() if state_col else pd.Series(False, index=df.index)
        agg_mask = mask_sd | mask_dist | mask_state
        dropped = agg_mask.sum()
        df = df[~agg_mask]
        logger.info(f"[CLEAN] Filtered {dropped:,} aggregation/header rows")

    after = len(df)
    logger.info(f"[CLEAN] {before:,} -> {after:,} rows ({before - after:,} removed)")
    return df.reset_index(drop=True)


# --- Database -----------------------------------------------------------------

def get_database_url():
    for env_path in [ROOT / ".env", ROOT / "api" / ".env"]:
        if env_path.exists():
            load_dotenv(env_path)
            break
    else:
        load_dotenv()

    url = os.environ.get("DATABASE_URL")
    if not url:
        logger.error("[ERROR] DATABASE_URL not found. Create .env with DATABASE_URL=...")
        sys.exit(1)
    return url


def connect(database_url):
    conn = psycopg2.connect(
        database_url,
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5,
        connect_timeout=30,
    )
    conn.autocommit = False
    return conn


def reconnect(database_url, retries=5, delay=5):
    for attempt in range(1, retries + 1):
        try:
            conn = connect(database_url)
            logger.info(f"[DB] Reconnected (attempt {attempt})")
            return conn
        except psycopg2.Error as e:
            logger.error(f"[DB] Reconnect attempt {attempt} failed: {e}")
            if attempt < retries:
                time.sleep(delay * attempt)
    logger.error("[DB] All reconnection attempts failed")
    sys.exit(1)


def safe_execute(conn, cur, database_url, sql, params=None):
    """Execute with automatic reconnect on connection loss."""
    try:
        if params:
            cur.execute(sql, params)
        else:
            cur.execute(sql)
        return conn, cur
    except psycopg2.OperationalError:
        logger.info("[DB] Connection lost, reconnecting...")
        conn = reconnect(database_url)
        cur = conn.cursor()
        if params:
            cur.execute(sql, params)
        else:
            cur.execute(sql)
        return conn, cur


def safe_batch_execute(conn, cur, database_url, sql, values, page_size=500):
    """execute_values with automatic reconnect."""
    try:
        execute_values(cur, sql, values, page_size=page_size)
        return conn, cur
    except psycopg2.OperationalError:
        logger.info("[DB] Connection lost during batch, reconnecting...")
        conn = reconnect(database_url)
        cur = conn.cursor()
        execute_values(cur, sql, values, page_size=page_size)
        return conn, cur


# --- Import -------------------------------------------------------------------

def import_data(df, col_map):
    database_url = get_database_url()
    conn = connect(database_url)
    cur = conn.cursor()
    start_time = time.time()
    logger.info("[DB] Connected")

    state_col = col_map["state_name"]
    dist_col = col_map["district_name"]
    sd_col = col_map["subdistrict_name"]
    village_col = col_map["village_name"]
    village_code_col = col_map.get("village_code")

    try:
        # === COUNTRY ===
        conn, cur = safe_execute(conn, cur, database_url,
            'INSERT INTO "Country" (name, code) VALUES (%s, %s) ON CONFLICT (code) DO NOTHING',
            (COUNTRY_NAME, COUNTRY_CODE))
        conn, cur = safe_execute(conn, cur, database_url,
            'SELECT id FROM "Country" WHERE code = %s', (COUNTRY_CODE,))
        country_id = cur.fetchone()[0]
        conn.commit()
        logger.info(f"[COUNTRY] India (IN) -> id={country_id}")

        # === STATES (batch insert + fetch all) ===
        unique_states = sorted(df[state_col].unique())
        state_values = [(f"ST{i+1:03d}", name, country_id) for i, name in enumerate(unique_states)]

        conn, cur = safe_batch_execute(conn, cur, database_url,
            'INSERT INTO "State" (code, name, "countryId") VALUES %s ON CONFLICT (code, "countryId") DO NOTHING',
            state_values)
        conn.commit()

        conn, cur = safe_execute(conn, cur, database_url,
            'SELECT id, name FROM "State" WHERE "countryId" = %s', (country_id,))
        state_cache = {row[1]: row[0] for row in cur.fetchall()}
        logger.info(f"[STATES] {len(state_cache)} states loaded")

        # === DISTRICTS (batch insert per state) ===
        unique_districts = df.drop_duplicates(subset=[state_col, dist_col])[[state_col, dist_col]]
        district_cache = {}  # "name:state_id" -> id
        dist_idx = 0

        # Group by state for smaller batch inserts
        for state_name in unique_states:
            state_id = state_cache.get(state_name)
            if not state_id:
                continue

            state_dists = unique_districts[unique_districts[state_col] == state_name][dist_col].unique()
            dist_values = []
            for dname in state_dists:
                dist_idx += 1
                dist_values.append((f"DT{dist_idx:05d}", dname, state_id))

            if dist_values:
                conn, cur = safe_batch_execute(conn, cur, database_url,
                    'INSERT INTO "District" (code, name, "stateId") VALUES %s ON CONFLICT (code, "stateId") DO NOTHING',
                    dist_values)
                conn.commit()

        # Fetch all districts
        conn, cur = safe_execute(conn, cur, database_url,
            'SELECT id, name, "stateId" FROM "District"')
        for row in cur.fetchall():
            district_cache[f"{row[1]}:{row[2]}"] = row[0]
        logger.info(f"[DISTRICTS] {len(district_cache)} districts loaded")

        # === SUB-DISTRICTS (batch insert per district, chunked) ===
        unique_sds = df.drop_duplicates(subset=[state_col, dist_col, sd_col])[
            [state_col, dist_col, sd_col]
        ]
        sd_cache = {}
        sd_idx = 0

        # Check how many already exist
        conn, cur = safe_execute(conn, cur, database_url,
            'SELECT COUNT(*) FROM "SubDistrict"')
        existing_sd_count = cur.fetchone()[0]
        logger.info(f"[SUBDISTRICTS] {existing_sd_count} already exist, need {len(unique_sds)} total")

        # Build all sub-district tuples first
        sd_tuples = []
        for _, row in unique_sds.iterrows():
            state_name = row[state_col]
            district_name = row[dist_col]
            sd_name = row[sd_col]
            state_id = state_cache.get(state_name)
            if not state_id:
                continue
            district_id = district_cache.get(f"{district_name}:{state_id}")
            if not district_id:
                continue
            sd_idx += 1
            sd_tuples.append((f"SD{sd_idx:06d}", sd_name, district_id))

        # Batch insert in chunks of 500
        SD_BATCH = 500
        total_sd_batches = (len(sd_tuples) + SD_BATCH - 1) // SD_BATCH
        for i in range(0, len(sd_tuples), SD_BATCH):
            chunk = sd_tuples[i:i + SD_BATCH]
            batch_num = i // SD_BATCH + 1
            try:
                conn, cur = safe_batch_execute(conn, cur, database_url,
                    'INSERT INTO "SubDistrict" (code, name, "districtId") VALUES %s '
                    'ON CONFLICT (code, "districtId") DO NOTHING',
                    chunk)
                conn.commit()
                if batch_num % 3 == 0 or batch_num == total_sd_batches:
                    logger.info(f"[SUBDISTRICTS] Batch {batch_num}/{total_sd_batches}")
            except psycopg2.Error as e:
                logger.error(f"[SUBDISTRICTS] Batch {batch_num} error: {e}")
                conn = reconnect(database_url)
                cur = conn.cursor()
                try:
                    execute_values(cur,
                        'INSERT INTO "SubDistrict" (code, name, "districtId") VALUES %s '
                        'ON CONFLICT (code, "districtId") DO NOTHING',
                        chunk, page_size=100)
                    conn.commit()
                except psycopg2.Error as e2:
                    logger.error(f"[SUBDISTRICTS] Retry failed: {e2}")
                    conn.rollback()

        # Fetch all sub-districts
        conn, cur = safe_execute(conn, cur, database_url,
            'SELECT id, name, "districtId" FROM "SubDistrict"')
        for row in cur.fetchall():
            sd_cache[f"{row[1]}:{row[2]}"] = row[0]
        logger.info(f"[SUBDISTRICTS] {len(sd_cache)} sub-districts loaded")

        # === VILLAGES (batch execute_values in chunks of 5000) ===
        total_rows = len(df)
        total_batches = (total_rows + BATCH_SIZE - 1) // BATCH_SIZE
        total_inserted = 0
        total_skipped = 0
        total_errors = 0
        village_code_counter = 0

        logger.info(f"[VILLAGES] Importing {total_rows:,} villages in {total_batches} batches...")

        for batch_num in range(total_batches):
            start = batch_num * BATCH_SIZE
            end = min(start + BATCH_SIZE, total_rows)
            batch = df.iloc[start:end]

            values = []
            for _, row in batch.iterrows():
                state_name = row[state_col]
                district_name = row[dist_col]
                sd_name = row[sd_col]
                v_name = row[village_col]

                state_id = state_cache.get(state_name)
                if not state_id:
                    total_errors += 1
                    continue
                district_id = district_cache.get(f"{district_name}:{state_id}")
                if not district_id:
                    total_errors += 1
                    continue
                sd_id = sd_cache.get(f"{sd_name}:{district_id}")
                if not sd_id:
                    total_errors += 1
                    continue

                if village_code_col and village_code_col in df.columns:
                    v_code = str(row[village_code_col]).strip()
                    if not v_code or v_code in ("", "nan", "None"):
                        village_code_counter += 1
                        v_code = f"VL{village_code_counter:08d}"
                else:
                    village_code_counter += 1
                    v_code = f"VL{village_code_counter:08d}"

                values.append((v_code, v_name, sd_id))

            if not values:
                continue

            try:
                conn, cur = safe_batch_execute(conn, cur, database_url,
                    'INSERT INTO "Village" (code, name, "subDistrictId") VALUES %s '
                    'ON CONFLICT (code) DO NOTHING',
                    values, page_size=1000)
                inserted = cur.rowcount
                total_inserted += inserted
                total_skipped += len(values) - inserted
                conn.commit()
            except psycopg2.Error as e:
                logger.error(f"[VILLAGES] Batch {batch_num+1} error: {e}")
                try:
                    conn.rollback()
                except Exception:
                    pass
                conn = reconnect(database_url)
                cur = conn.cursor()
                try:
                    execute_values(cur,
                        'INSERT INTO "Village" (code, name, "subDistrictId") VALUES %s '
                        'ON CONFLICT (code) DO NOTHING',
                        values, page_size=500)
                    inserted = cur.rowcount
                    total_inserted += inserted
                    total_skipped += len(values) - inserted
                    conn.commit()
                except psycopg2.Error as e2:
                    total_errors += len(values)
                    logger.error(f"[VILLAGES] Retry failed: {e2}")
                    try:
                        conn.rollback()
                    except Exception:
                        pass

            if (batch_num + 1) % 5 == 0 or batch_num == total_batches - 1:
                logger.info(
                    f"[VILLAGES] Batch {batch_num+1}/{total_batches} -- "
                    f"inserted: {total_inserted:,}  skipped: {total_skipped:,}  errors: {total_errors:,}"
                )

        elapsed = time.time() - start_time
        summary = (
            f"\n{'=' * 60}\n"
            f"  IMPORT COMPLETE\n"
            f"{'=' * 60}\n"
            f"  Time:           {elapsed:.1f}s\n"
            f"  States:         {len(state_cache):,}\n"
            f"  Districts:      {len(district_cache):,}\n"
            f"  Sub-Districts:  {len(sd_cache):,}\n"
            f"  Villages:       {total_inserted:,} inserted / {total_skipped:,} skipped / {total_errors:,} errors\n"
            f"  Total rows:     {total_rows:,}\n"
            f"{'=' * 60}\n"
        )
        logger.info(summary)

    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        logger.error(f"[FATAL] {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        try:
            cur.close()
            conn.close()
        except Exception:
            pass
        logger.info(f"[LOG] Written to {LOG_FILE}")


# --- Main ---------------------------------------------------------------------

def main():
    logger.info(f"{'=' * 60}")
    logger.info(f"  VillageAPI -- Data Import Pipeline")
    logger.info(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"{'=' * 60}\n")

    if len(sys.argv) >= 2:
        filepath = Path(sys.argv[1])
        if not filepath.is_absolute():
            filepath = ROOT / filepath
    else:
        filepath = DEFAULT_FILE

    if not filepath.is_file():
        alt = filepath.parent / "villages.parquet"
        if alt.is_file():
            filepath = alt
        else:
            logger.error(f"[ERROR] File not found: {filepath}")
            sys.exit(1)

    df = read_file(filepath)

    logger.info(f"\n[COLUMNS] ({len(df.columns)} total):")
    for i, col in enumerate(df.columns):
        logger.info(f"  [{i}] {col!r}  (dtype: {df[col].dtype})")

    logger.info(f"\n[PREVIEW] First 5 rows:")
    logger.info(df.head(5).to_string(index=True))

    col_map = resolve_columns(df)
    logger.info(f"\n[MAPPING]:")
    unresolved = []
    for canonical, actual in col_map.items():
        status = f"-> {actual!r}" if actual else "!! NOT FOUND"
        logger.info(f"  {canonical:20s} {status}")
        if not actual and canonical in REQUIRED_CANONICAL:
            unresolved.append(canonical)

    if unresolved:
        logger.error(f"\n[ERROR] Missing required columns: {', '.join(unresolved)}")
        logger.error(f"  Actual columns: {list(df.columns)}")
        sys.exit(1)

    df = clean_dataframe(df, col_map)
    if len(df) == 0:
        logger.error("[ERROR] No rows remaining after cleaning")
        sys.exit(1)

    sc, dc, sdc = col_map["state_name"], col_map["district_name"], col_map["subdistrict_name"]
    logger.info(f"\n{'_' * 50}")
    logger.info(f"  States:        {df[sc].nunique():>8,}")
    logger.info(f"  Districts:     {df.drop_duplicates([sc, dc]).shape[0]:>8,}")
    logger.info(f"  Sub-Districts: {df.drop_duplicates([sc, dc, sdc]).shape[0]:>8,}")
    logger.info(f"  Villages:      {len(df):>8,}")
    logger.info(f"{'_' * 50}\n")

    import_data(df, col_map)
    logger.info("[DONE]")


if __name__ == "__main__":
    main()
