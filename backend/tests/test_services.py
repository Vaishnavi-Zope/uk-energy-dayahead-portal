import pytest
from app.services.alignment import calculate_cutoff_timestamp, get_aligned_day_data, get_available_dates
from app.services.analytics import get_aggregate_analytics
from app.services.procurement import simulate_day_ahead_procurement


def test_calculate_cutoff_timestamp():
    cutoff = calculate_cutoff_timestamp("2026-01-15", cutoff_hour=11, cutoff_minute=0)
    assert cutoff == "2026-01-14T11:00:00Z"
    
    cutoff_early = calculate_cutoff_timestamp("2026-01-01", cutoff_hour=9, cutoff_minute=30)
    assert cutoff_early == "2025-12-31T09:30:00Z"


def test_available_dates():
    dates = get_available_dates()
    assert len(dates) == 31
    assert dates[0] == "2026-01-01"
    assert dates[-1] == "2026-01-31"


def test_aligned_day_data_structure():
    res = get_aligned_day_data("2026-01-10", cutoff_hour=11)
    assert "error" not in res
    assert res["delivery_date"] == "2026-01-10"
    assert res["cutoff_hour"] == 11
    
    # 48 Settlement Periods
    assert len(res["half_hourly"]) == 48
    assert res["half_hourly"][0]["settlement_period"] == 1
    assert res["half_hourly"][47]["settlement_period"] == 48
    
    # 24 Hours
    assert len(res["hourly"]) == 24
    
    # Zero lookahead verification: all used forecasts must have publish_time <= cutoff
    cutoff_ts = res["cutoff_timestamp"]
    for sp in res["half_hourly"]:
        if sp["forecast_publish_time"]:
            assert sp["forecast_publish_time"] <= cutoff_ts
            
    summary = res["summary"]
    assert summary["mae_mw"] >= 0.0
    assert summary["rmse_mw"] >= summary["mae_mw"]


def test_aggregate_analytics_metrics():
    res = get_aggregate_analytics("2026-01-01", "2026-01-10", cutoff_hour=11)
    assert "error" not in res
    assert res["total_periods"] == 10 * 48
    
    m = res["metrics"]
    assert m["mae_mw"] > 0
    assert m["rmse_mw"] >= m["mae_mw"]
    assert "p10_mw" in m["quantiles"]
    assert "p90_mw" in m["quantiles"]
    assert m["quantiles"]["p90_mw"] >= m["quantiles"]["p10_mw"]
    
    # Histogram has bins
    assert len(res["histogram"]) > 0
    # Diurnal has 24 hours
    assert len(res["diurnal_profile"]) == 24


def test_procurement_simulation():
    res = simulate_day_ahead_procurement(
        delivery_date="2026-01-15",
        cutoff_hour=11,
        base_demand_mw=25000.0,
        confidence_level=0.90
    )
    assert "error" not in res
    assert res["recommended_buffer_mw"] > 0
    assert len(res["half_hourly"]) == 48
    
    summary = res["summary"]
    assert summary["total_adjusted_procurement_gwh"] >= summary["total_naive_procurement_gwh"]
    assert summary["adjusted_shortage_exposure_mwh"] <= summary["naive_shortage_exposure_mwh"]
