import psycopg2, os
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent.parent / ".env")
conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()
for t in ["Country", "State", "District", "SubDistrict", "Village"]:
    cur.execute(f'SELECT COUNT(*) FROM "{t}"')
    print(f"{t:15s} {cur.fetchone()[0]:>8,}")
cur.close()
conn.close()
