import sqlite3
import os
import math
from typing import Dict, Any, List, Optional
from .alignment import get_aligned_day_data, get_available_dates, DB_PATH


def get_aggregate_analytics(
    start_date: str = "2026-01-01",
    end_date: str = "2026-01-31",
    cutoff_hour: int = 11,
    db_path: str = DB_PATH
) -> Dict[str, Any]:
    """
    Computes rigorous statistical and quantitative risk metrics
    across all days in [start_date, end_date] for the given Day-Ahead cutoff.
    """
    all_dates = get_available_dates(db_path)
    selected_dates = [d for d in all_dates if start_date <= d <= end_date]
    
    if not selected_dates:
        return {"error": "No data found for the selected date range."}
        
    all_errors: List[float] = []
    all_abs_errors: List[float] = []
    all_actuals: List[float] = []
    all_forecasts: List[float] = []
    
    daily_summaries: List[Dict[str, Any]] = []
    hourly_accumulators: Dict[int, Dict[str, List[float]]] = {
        h: {"actuals": [], "forecasts": [], "errors": []} for h in range(24)
    }
    
    for d_str in selected_dates:
        day_res = get_aligned_day_data(d_str, cutoff_hour=cutoff_hour, db_path=db_path)
        if "error" in day_res:
            continue
            
        sum_info = day_res["summary"]
        daily_summaries.append({
            "date": d_str,
            "mae_mw": sum_info["mae_mw"],
            "rmse_mw": sum_info["rmse_mw"],
            "bias_mw": sum_info["bias_mw"],
            "actual_energy_gwh": sum_info["actual_energy_gwh"],
            "forecast_energy_gwh": sum_info["forecast_energy_gwh"]
        })
        
        for sp in day_res["half_hourly"]:
            if sp["actual_mw"] is not None and sp["forecast_mw"] is not None:
                err = sp["error_mw"]
                all_errors.append(err)
                all_abs_errors.append(abs(err))
                all_actuals.append(sp["actual_mw"])
                all_forecasts.append(sp["forecast_mw"])
                
        for h_row in day_res["hourly"]:
            h = h_row["hour"]
            if h_row["actual_mw"] is not None and h_row["forecast_mw"] is not None:
                hourly_accumulators[h]["actuals"].append(h_row["actual_mw"])
                hourly_accumulators[h]["forecasts"].append(h_row["forecast_mw"])
                hourly_accumulators[h]["errors"].append(h_row["error_mw"])

    if not all_errors:
        return {"error": "No aligned intervals found."}

    n = len(all_errors)
    sorted_errors = sorted(all_errors)
    
    mae = round(sum(all_abs_errors) / n, 1)
    mse = sum(e ** 2 for e in all_errors) / n
    rmse = round(math.sqrt(mse), 1)
    mean_bias = round(sum(all_errors) / n, 1)
    
    total_actual = sum(all_actuals)
    total_forecast = sum(all_forecasts)
    wape = round((sum(all_abs_errors) / total_actual * 100.0), 2) if total_actual > 0 else 0.0
    bias_pct = round((mean_bias / (total_actual / n) * 100.0), 2) if total_actual > 0 else 0.0
    
    # Quantiles
    def get_quantile(sorted_arr: List[float], q: float) -> float:
        idx = int(q * (len(sorted_arr) - 1))
        return round(sorted_arr[idx], 1)
        
    p10 = get_quantile(sorted_errors, 0.10)
    p25 = get_quantile(sorted_errors, 0.25)
    p50 = get_quantile(sorted_errors, 0.50)
    p75 = get_quantile(sorted_errors, 0.75)
    p90 = get_quantile(sorted_errors, 0.90)
    p95 = get_quantile(sorted_errors, 0.95)
    
    # Error distribution histogram (bins of 500 MW from -6000 to +6000)
    bin_size = 500
    min_bin = -6000
    max_bin = 6000
    bins: Dict[int, int] = {}
    for b in range(min_bin, max_bin, bin_size):
        bins[b] = 0
        
    for e in all_errors:
        b_idx = int(math.floor(e / bin_size) * bin_size)
        if b_idx < min_bin:
            b_idx = min_bin
        elif b_idx >= max_bin:
            b_idx = max_bin - bin_size
        bins[b_idx] = bins.get(b_idx, 0) + 1
        
    histogram = []
    for b in sorted(bins.keys()):
        label = f"{b:+d} to {b+bin_size:+d} MW"
        histogram.append({
            "bin_start": b,
            "bin_end": b + bin_size,
            "label": label,
            "count": bins[b],
            "percentage": round(bins[b] / n * 100.0, 2)
        })
        
    # Diurnal profile: Average error, actual, and forecast for each hour of day (0-23)
    diurnal_profile = []
    for h in range(24):
        h_acts = hourly_accumulators[h]["actuals"]
        h_fcs = hourly_accumulators[h]["forecasts"]
        h_errs = hourly_accumulators[h]["errors"]
        count = len(h_errs)
        avg_act = round(sum(h_acts) / count, 1) if count > 0 else 0.0
        avg_fc = round(sum(h_fcs) / count, 1) if count > 0 else 0.0
        avg_err = round(sum(h_errs) / count, 1) if count > 0 else 0.0
        h_mae = round(sum(abs(x) for x in h_errs) / count, 1) if count > 0 else 0.0
        
        diurnal_profile.append({
            "hour": h,
            "time_label": f"{h:02d}:00",
            "avg_actual_mw": avg_act,
            "avg_forecast_mw": avg_fc,
            "avg_error_mw": avg_err,
            "mae_mw": h_mae,
            "periods_count": count
        })
        
    return {
        "start_date": start_date,
        "end_date": end_date,
        "cutoff_hour": cutoff_hour,
        "total_periods": n,
        "metrics": {
            "mae_mw": mae,
            "rmse_mw": rmse,
            "mean_bias_mw": mean_bias,
            "mean_bias_pct": bias_pct,
            "wape_pct": wape,
            "max_overforecast_mw": round(max(all_errors), 1),
            "max_underforecast_mw": round(min(all_errors), 1),
            "total_actual_gwh": round(total_actual * 0.5 / 1000.0, 1),
            "total_forecast_gwh": round(total_forecast * 0.5 / 1000.0, 1),
            "quantiles": {
                "p10_mw": p10,
                "p25_mw": p25,
                "p50_mw": p50,
                "p75_mw": p75,
                "p90_mw": p90,
                "p95_mw": p95
            }
        },
        "histogram": histogram,
        "diurnal_profile": diurnal_profile,
        "daily_breakdown": daily_summaries
    }
