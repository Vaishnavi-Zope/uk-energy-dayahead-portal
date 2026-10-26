import os
import json
import sqlite3
import urllib.request
import logging
from typing import Dict, Any, List

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
DB_PATH = os.path.join(DATA_DIR, "energy_data.db")
FUELHH_CACHE = os.path.join(DATA_DIR, "fuelhh_wind_jan2026.json")
WINDFOR_CACHE = os.path.join(DATA_DIR, "windfor_jan2026.json")


def init_db(db_path: str = DB_PATH) -> sqlite3.Connection:
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # Table for actual wind generation (FUELHH)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS actual_wind (
        start_time TEXT PRIMARY KEY,
        settlement_date TEXT,
        settlement_period INTEGER,
        generation REAL,
        publish_time TEXT
    )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_actual_date ON actual_wind(settlement_date)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_actual_start ON actual_wind(start_time)")
    
    # Table for forecasted wind generation (WINDFOR)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS forecast_wind (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        publish_time TEXT,
        start_time TEXT,
        generation REAL
    )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_forecast_start ON forecast_wind(start_time)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_forecast_pub ON forecast_wind(publish_time)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_forecast_match ON forecast_wind(start_time, publish_time)")
    
    conn.commit()
    return conn


def fetch_fuelhh_wind(settlement_date_from: str = "2026-01-01", settlement_date_to: str = "2026-01-31") -> List[Dict[str, Any]]:
    if os.path.exists(FUELHH_CACHE):
        logger.info(f"Loading FUELHH actuals from cache: {FUELHH_CACHE}")
        with open(FUELHH_CACHE, "r", encoding="utf-8") as f:
            return json.load(f)
            
    url = f"https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream?settlementDateFrom={settlement_date_from}&settlementDateTo={settlement_date_to}"
    logger.info(f"Fetching FUELHH from Elexon BMRS: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "UK-DayAhead-EnergyApp/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        
    wind_data = [d for d in data if d.get("fuelType") == "WIND"]
    logger.info(f"Fetched {len(wind_data)} wind actual records.")
    
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(FUELHH_CACHE, "w", encoding="utf-8") as f:
        json.dump(wind_data, f)
        
    return wind_data


def fetch_windfor(publish_from: str = "2025-12-30T00:00:00Z", publish_to: str = "2026-01-31T23:59:59Z") -> List[Dict[str, Any]]:
    if os.path.exists(WINDFOR_CACHE):
        logger.info(f"Loading WINDFOR forecasts from cache: {WINDFOR_CACHE}")
        with open(WINDFOR_CACHE, "r", encoding="utf-8") as f:
            return json.load(f)
            
    url = f"https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream?publishDateTimeFrom={publish_from}&publishDateTimeTo={publish_to}"
    logger.info(f"Fetching WINDFOR from Elexon BMRS: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "UK-DayAhead-EnergyApp/1.0"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        
    logger.info(f"Fetched {len(data)} wind forecast records.")
    
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(WINDFOR_CACHE, "w", encoding="utf-8") as f:
        json.dump(data, f)
        
    return data


def ingest_all(db_path: str = DB_PATH):
    conn = init_db(db_path)
    cur = conn.cursor()
    
    cur.execute("SELECT COUNT(*) FROM actual_wind")
    actual_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM forecast_wind")
    forecast_count = cur.fetchone()[0]
    
    if actual_count > 0 and forecast_count > 0:
        logger.info(f"Database already populated: {actual_count} actuals, {forecast_count} forecasts.")
        conn.close()
        return
        
    logger.info("Ingesting January 2026 energy datasets into SQLite...")
    actuals = fetch_fuelhh_wind()
    forecasts = fetch_windfor()
    
    # Insert actuals
    cur.execute("BEGIN TRANSACTION")
    for a in actuals:
        cur.execute("""
        INSERT OR REPLACE INTO actual_wind (start_time, settlement_date, settlement_period, generation, publish_time)
        VALUES (?, ?, ?, ?, ?)
        """, (
            a.get("startTime"),
            a.get("settlementDate"),
            a.get("settlementPeriod"),
            float(a.get("generation", 0.0)),
            a.get("publishTime")
        ))
        
    for f in forecasts:
        cur.execute("""
        INSERT INTO forecast_wind (publish_time, start_time, generation)
        VALUES (?, ?, ?)
        """, (
            f.get("publishTime"),
            f.get("startTime"),
            float(f.get("generation", 0.0))
        ))
    conn.commit()
    conn.close()
    logger.info("Ingestion completed successfully.")


if __name__ == "__main__":
    ingest_all()
