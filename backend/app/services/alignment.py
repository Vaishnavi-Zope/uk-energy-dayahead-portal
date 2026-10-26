import sqlite3
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
DB_PATH = os.path.join(DATA_DIR, "energy_data.db")


def get_db_connection(db_path: str = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def calculate_cutoff_timestamp(delivery_date_str: str, cutoff_hour: int = 11, cutoff_minute: int = 0) -> str:
    """
    Day-Ahead gate closure is on Day D-1 at cutoff_hour:cutoff_minute UTC.
    For delivery day 2026-01-15 and cutoff_hour=11, returns '2026-01-14T11:00:00Z'.
    """
    deliv_date = datetime.strptime(delivery_date_str, "%Y-%m-%d")
    decision_date = deliv_date - timedelta(days=1)
    cutoff_dt = decision_date.replace(hour=cutoff_hour, minute=cutoff_minute, second=0, microsecond=0)
    return cutoff_dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def get_aligned_day_data(delivery_date_str: str, cutoff_hour: int = 11, db_path: str = DB_PATH) -> Dict[str, Any]:
    """
    Returns half-hourly and hourly aligned actual vs day-ahead forecast data
    for a specific delivery day in January 2026.
    Zero lookahead bias is guaranteed: only forecasts published <= (D-1 cutoff) are used.
    """
    conn = get_db_connection(db_path)
    cur = conn.cursor()
    
    cutoff_ts = calculate_cutoff_timestamp(delivery_date_str, cutoff_hour=cutoff_hour)
    
    # 1. Fetch 48 Settlement Periods of actuals from actual_wind
    cur.execute("""
    SELECT start_time, settlement_date, settlement_period, generation
    FROM actual_wind
    WHERE settlement_date = ?
    ORDER BY settlement_period ASC
    """, (delivery_date_str,))
    actual_rows = cur.fetchall()
    
    if not actual_rows:
        conn.close()
        return {"error": f"No actual data found for date {delivery_date_str}"}
        
    actuals_by_sp = {r["settlement_period"]: dict(r) for r in actual_rows}
    
    # 2. Fetch all WINDFOR records published on or before cutoff_ts whose start_time is on delivery_date
    start_prefix = f"{delivery_date_str}%"
    cur.execute("""
    SELECT start_time, publish_time, generation
    FROM forecast_wind
    WHERE start_time LIKE ? AND publish_time <= ?
    ORDER BY start_time ASC, publish_time DESC
    """, (start_prefix, cutoff_ts))
    forecast_rows = cur.fetchall()
    
    # For each forecast start_time (which is hourly in WINDFOR), find the latest published
    latest_hourly_forecast: Dict[str, Dict[str, Any]] = {}
    for r in forecast_rows:
        st = r["start_time"]
        if st not in latest_hourly_forecast:
            latest_hourly_forecast[st] = dict(r)
            
    conn.close()
    
    # 3. Build Half-Hourly (Settlement Period) Series (48 SPs)
    sp_series = []
    daily_actual_energy_mwh = 0.0
    daily_forecast_energy_mwh = 0.0
    abs_errors = []
    errors = []
    
    for sp in range(1, 49):
        # Calculate start_time for this settlement period:
        # SP 1 = 00:00, SP 2 = 00:30, SP 3 = 01:00, etc.
        hour = (sp - 1) // 2
        minute = ((sp - 1) % 2) * 30
        sp_time_str = f"{delivery_date_str}T{hour:02d}:{minute:02d}:00Z"
        time_label = f"{hour:02d}:{minute:02d}"
        
        # Corresponding hourly forecast start_time is hour:00
        hourly_forecast_key = f"{delivery_date_str}T{hour:02d}:00:00Z"
        
        act_row = actuals_by_sp.get(sp)
        actual_mw = float(act_row["generation"]) if act_row else None
        
        fc_row = latest_hourly_forecast.get(hourly_forecast_key)
        forecast_mw = float(fc_row["generation"]) if fc_row else None
        fc_publish_time = fc_row["publish_time"] if fc_row else None
        
        error_mw = None
        error_abs_mw = None
        if actual_mw is not None and forecast_mw is not None:
            error_mw = round(forecast_mw - actual_mw, 1)
            error_abs_mw = abs(error_mw)
            abs_errors.append(error_abs_mw)
            errors.append(error_mw)
            daily_actual_energy_mwh += actual_mw * 0.5  # 30 mins = 0.5 h
            daily_forecast_energy_mwh += forecast_mw * 0.5
            
        sp_series.append({
            "settlement_period": sp,
            "start_time": sp_time_str,
            "time_label": time_label,
            "actual_mw": round(actual_mw, 1) if actual_mw is not None else None,
            "forecast_mw": round(forecast_mw, 1) if forecast_mw is not None else None,
            "error_mw": error_mw,
            "abs_error_mw": error_abs_mw,
            "forecast_publish_time": fc_publish_time
        })
        
    # 4. Build Hourly Aggregation (24 hours)
    hourly_series = []
    for h in range(24):
        sp1 = sp_series[h * 2]
        sp2 = sp_series[h * 2 + 1]
        
        h_actual = None
        if sp1["actual_mw"] is not None and sp2["actual_mw"] is not None:
            h_actual = round((sp1["actual_mw"] + sp2["actual_mw"]) / 2.0, 1)
        elif sp1["actual_mw"] is not None:
            h_actual = sp1["actual_mw"]
            
        h_forecast = sp1["forecast_mw"]
        h_error = round(h_forecast - h_actual, 1) if (h_actual is not None and h_forecast is not None) else None
        
        hourly_series.append({
            "hour": h,
            "time_label": f"{h:02d}:00",
            "start_time": f"{delivery_date_str}T{h:02d}:00:00Z",
            "actual_mw": h_actual,
            "forecast_mw": h_forecast,
            "error_mw": h_error,
            "abs_error_mw": abs(h_error) if h_error is not None else None,
            "forecast_publish_time": sp1["forecast_publish_time"]
        })
        
    # Daily summary metrics
    mae = round(sum(abs_errors) / len(abs_errors), 1) if abs_errors else 0.0
    rmse = round((sum(e ** 2 for e in errors) / len(errors)) ** 0.5, 1) if errors else 0.0
    bias = round(sum(errors) / len(errors), 1) if errors else 0.0
    
    return {
        "delivery_date": delivery_date_str,
        "cutoff_timestamp": cutoff_ts,
        "cutoff_hour": cutoff_hour,
        "summary": {
            "mae_mw": mae,
            "rmse_mw": rmse,
            "bias_mw": bias,
            "bias_type": "OVER_FORECAST" if bias > 0 else "UNDER_FORECAST",
            "actual_energy_gwh": round(daily_actual_energy_mwh / 1000.0, 2),
            "forecast_energy_gwh": round(daily_forecast_energy_mwh / 1000.0, 2),
            "periods_evaluated": len(abs_errors)
        },
        "half_hourly": sp_series,
        "hourly": hourly_series
    }


def get_available_dates(db_path: str = DB_PATH) -> List[str]:
    conn = get_db_connection(db_path)
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT settlement_date FROM actual_wind ORDER BY settlement_date ASC")
    dates = [r[0] for r in cur.fetchall()]
    conn.close()
    return dates
