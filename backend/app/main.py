import os
from typing import Optional
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.services.alignment import get_aligned_day_data, get_available_dates
from app.services.analytics import get_aggregate_analytics
from app.services.procurement import simulate_day_ahead_procurement
from app.services.ingestion import ingest_all

app = FastAPI(
    title="UK National Grid Day-Ahead Wind & Thermal Procurement API",
    description="Operational decision-support and forecast error quantification platform for UK power market procurement.",
    version="1.0.0"
)

# Enable CORS for local dev and cloud deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    # Ensure database is initialized and populated
    ingest_all()


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "uk-energy-dayahead-portal-api",
        "version": "1.0.0",
        "data_scope": "January 2026"
    }


@app.get("/api/dates")
def list_dates():
    """List all available delivery dates in January 2026."""
    dates = get_available_dates()
    return {"dates": dates}


@app.get("/api/day-curves")
def day_curves(
    date: str = Query("2026-01-15", description="Delivery date (YYYY-MM-DD)"),
    cutoff_hour: int = Query(11, description="Day-Ahead cutoff hour on Day D-1 (UTC)")
):
    """
    Get 48 Settlement Period and 24-hour curves for actual wind vs locked day-ahead forecast.
    Guarantees zero lookahead bias.
    """
    res = get_aligned_day_data(delivery_date_str=date, cutoff_hour=cutoff_hour)
    if "error" in res:
        raise HTTPException(status_code=404, detail=res["error"])
    return res


@app.get("/api/analytics/summary")
def analytics_summary(
    start_date: str = Query("2026-01-01", description="Start date (YYYY-MM-DD)"),
    end_date: str = Query("2026-01-31", description="End date (YYYY-MM-DD)"),
    cutoff_hour: int = Query(11, description="Day-Ahead cutoff hour on Day D-1 (UTC)")
):
    """
    Aggregate quantitative accuracy metrics (MAE, RMSE, Mean Bias, WAPE, Quantiles).
    """
    res = get_aggregate_analytics(start_date=start_date, end_date=end_date, cutoff_hour=cutoff_hour)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res


class ProcurementRequest(BaseModel):
    delivery_date: str = Field("2026-01-15", description="Delivery date in January 2026")
    cutoff_hour: int = Field(11, description="Day-Ahead gate closure hour on D-1")
    base_demand_mw: float = Field(25000.0, description="Base consumer demand in MW")
    confidence_level: float = Field(0.90, description="Statistical safety buffer confidence (0.50 to 0.95)")


@app.post("/api/procurement/simulate")
def simulate_procurement(payload: ProcurementRequest):
    """
    Simulates Day-Ahead net thermal power procurement with risk buffers.
    """
    res = simulate_day_ahead_procurement(
        delivery_date=payload.delivery_date,
        cutoff_hour=payload.cutoff_hour,
        base_demand_mw=payload.base_demand_mw,
        confidence_level=payload.confidence_level
    )
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
