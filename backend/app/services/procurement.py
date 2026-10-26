from typing import Dict, Any, List
from .alignment import get_aligned_day_data, DB_PATH
from .analytics import get_aggregate_analytics


def simulate_day_ahead_procurement(
    delivery_date: str,
    cutoff_hour: int = 11,
    base_demand_mw: float = 25000.0,
    confidence_level: float = 0.90,
    db_path: str = DB_PATH
) -> Dict[str, Any]:
    """
    Simulates Day-Ahead power procurement decisions for a UK utility.
    Calculates:
      1. Naive procurement: Demand - Wind Forecast
      2. Risk-adjusted procurement: Demand - Wind Forecast + Safety Buffer
      3. Actual outturn and imbalance exposure if Naive vs Adjusted was used.
    """
    # 1. Fetch day data
    day_data = get_aligned_day_data(delivery_date, cutoff_hour=cutoff_hour, db_path=db_path)
    if "error" in day_data:
        return day_data
        
    # 2. Get aggregate historical quantiles for buffer estimation
    analytics = get_aggregate_analytics(start_date="2026-01-01", end_date="2026-01-31", cutoff_hour=cutoff_hour, db_path=db_path)
    quantiles = analytics["metrics"]["quantiles"]
    
    # Map confidence level to quantile:
    # Notice: Over-forecast error = (Forecast - Actual).
    # If Forecast - Actual is positive, actual was less than forecast -> shortage!
    # To protect against 90% of shortage scenarios, we buffer by the 90th percentile of (Forecast - Actual).
    if confidence_level <= 0.50:
        buffer_mw = max(0.0, float(quantiles["p50_mw"]))
    elif confidence_level <= 0.75:
        buffer_mw = max(0.0, float(quantiles["p75_mw"]))
    elif confidence_level <= 0.90:
        buffer_mw = max(0.0, float(quantiles["p90_mw"]))
    else:
        buffer_mw = max(0.0, float(quantiles["p95_mw"]))
        
    # Standard UK peak demand profile multipliers across 48 settlement periods
    # (higher in morning SP 15-20 and evening peak SP 32-38)
    demand_factors = [
        0.72, 0.70, 0.68, 0.66, 0.65, 0.65, 0.67, 0.71, # 00:00 - 04:00
        0.78, 0.85, 0.95, 1.05, 1.10, 1.12, 1.14, 1.15, # 04:00 - 08:00
        1.14, 1.12, 1.10, 1.08, 1.06, 1.05, 1.04, 1.03, # 08:00 - 12:00
        1.02, 1.02, 1.03, 1.04, 1.06, 1.10, 1.15, 1.20, # 12:00 - 16:00
        1.25, 1.28, 1.27, 1.24, 1.18, 1.12, 1.05, 0.98, # 16:00 - 20:00
        0.92, 0.86, 0.82, 0.78, 0.75, 0.74, 0.73, 0.71  # 20:00 - 24:00
    ]
    
    periods_result = []
    total_naive_procurement_mwh = 0.0
    total_adjusted_procurement_mwh = 0.0
    total_naive_imbalance_shortage_mwh = 0.0
    total_adjusted_imbalance_shortage_mwh = 0.0
    
    for i, sp in enumerate(day_data["half_hourly"]):
        factor = demand_factors[i] if i < len(demand_factors) else 1.0
        demand_sp = round(base_demand_mw * factor, 1)
        
        fc_wind = sp["forecast_mw"] or 0.0
        act_wind = sp["actual_mw"] or 0.0
        
        naive_thermal_mw = max(0.0, demand_sp - fc_wind)
        adjusted_thermal_mw = max(0.0, demand_sp - fc_wind + buffer_mw)
        
        # Real-time outturn balance:
        # Total supplied = Thermal Bought + Actual Wind
        naive_supplied = naive_thermal_mw + act_wind
        adjusted_supplied = adjusted_thermal_mw + act_wind
        
        # Shortage = Max(0, Demand - Supplied)
        naive_shortage_mw = max(0.0, demand_sp - naive_supplied)
        adjusted_shortage_mw = max(0.0, demand_sp - adjusted_supplied)
        
        total_naive_procurement_mwh += naive_thermal_mw * 0.5
        total_adjusted_procurement_mwh += adjusted_thermal_mw * 0.5
        total_naive_imbalance_shortage_mwh += naive_shortage_mw * 0.5
        total_adjusted_imbalance_shortage_mwh += adjusted_shortage_mw * 0.5
        
        periods_result.append({
            "settlement_period": sp["settlement_period"],
            "time_label": sp["time_label"],
            "demand_mw": demand_sp,
            "forecast_wind_mw": fc_wind,
            "actual_wind_mw": act_wind,
            "naive_procurement_mw": round(naive_thermal_mw, 1),
            "adjusted_procurement_mw": round(adjusted_thermal_mw, 1),
            "buffer_mw": round(buffer_mw, 1),
            "naive_shortage_mw": round(naive_shortage_mw, 1),
            "adjusted_shortage_mw": round(adjusted_shortage_mw, 1)
        })
        
    # Imbalance penalty estimation: assume £95/MWh day-ahead vs £180/MWh cashout buy penalty
    cashout_spread = 85.0  # £/MWh penalty spread
    naive_penalty_cost = round(total_naive_imbalance_shortage_mwh * cashout_spread, 2)
    adjusted_penalty_cost = round(total_adjusted_imbalance_shortage_mwh * cashout_spread, 2)
    estimated_savings = max(0.0, round(naive_penalty_cost - adjusted_penalty_cost, 2))
    
    return {
        "delivery_date": delivery_date,
        "base_demand_mw": base_demand_mw,
        "confidence_level": confidence_level,
        "recommended_buffer_mw": round(buffer_mw, 1),
        "summary": {
            "total_naive_procurement_gwh": round(total_naive_procurement_mwh / 1000.0, 2),
            "total_adjusted_procurement_gwh": round(total_adjusted_procurement_mwh / 1000.0, 2),
            "naive_shortage_exposure_mwh": round(total_naive_imbalance_shortage_mwh, 1),
            "adjusted_shortage_exposure_mwh": round(total_adjusted_imbalance_shortage_mwh, 1),
            "shortage_reduction_pct": round(
                ((total_naive_imbalance_shortage_mwh - total_adjusted_imbalance_shortage_mwh) / total_naive_imbalance_shortage_mwh * 100.0), 1
            ) if total_naive_imbalance_shortage_mwh > 0 else 100.0,
            "estimated_cashout_savings_gbp": estimated_savings
        },
        "half_hourly": periods_result
    }
