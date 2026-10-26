# UK Day-Ahead Renewable Procurement & Forecasting Portal

> **Live Demo:** [https://uk-energy-dayahead-portal.vercel.app](https://uk-energy-dayahead-portal.vercel.app) *(Deployment Target: Vercel / Render / Heroku)*  
> **API Documentation (Swagger):** `http://localhost:8000/docs` or `https://uk-energy-backend.onrender.com/docs`  
> **Target Scope:** UK Wholesale Day-Ahead Power Market • January 2026 Data

---

## 1. Executive Summary & Business Problem

Electricity retailers in the United Kingdom must procure wholesale power in the **Day-Ahead Market** (typically at the 11:00 UTC EPEX SPOT gate closure on Day $D-1$) to meet consumer electricity demand on Day $D$. 

Because wind generation has zero marginal fuel cost, utilities prioritize buying thermal power only to cover the net deficit:
$$\text{Net Thermal Procurement} = \text{Consumer Demand} - \text{Wind Generation}$$

### The Commercial Challenge:
Wind generation is weather-dependent and volatile. If the utility relies on raw forecasts without understanding prediction errors:
* **Over-forecasting:** The utility under-procures thermal power. When actual wind falls short, they must purchase balance energy in real-time at punitive **System Buy Prices (cashout imbalance charges)**, costing utilities millions of pounds annually.
* **Under-forecasting:** The utility buys excess thermal power and is forced to dump spillover at discounted prices.

### Our Solution:
This web platform provides energy trading and power procurement teams with:
1. **Zero-Lookahead Day-Ahead Visibility:** Displays the exact wind generation forecasts available at gate closure (D-1 at 11:00 UTC), mapping them directly against actual outturn across all 48 UK Settlement Periods.
2. **Quantified Forecast Accuracy & Risk:** Computes institutional-grade error metrics (MAE, RMSE, Mean Bias, WAPE, and $P_{10}/P_{90}$ error quantiles) across all 1,488 settlement periods in January 2026.
3. **What-If Procurement Decision Simulator:** Translates forecast error distributions into a dynamic thermal procurement safety buffer, demonstrating real-time mitigation of cashout imbalance risk.

---

## 2. System Architecture

```
                       ┌───────────────────────────────────────────────┐
                       │           Elexon BMRS Open APIs               │
                       │  - FUELHH (Actual Half-Hourly Outturn)        │
                       │  - WINDFOR (Day-Ahead Forecast Series)        │
                       └───────────────────────┬───────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  FastAPI Backend (Python 3.11)                              │
│                                                                                             │
│  ┌───────────────────────────┐    ┌───────────────────────────┐    ┌─────────────────────┐  │
│  │   Ingestion & Cache ETL   │    │  Point-in-Time Matcher    │    │  Analytics Engine   │  │
│  │   (SQLite / DuckDB Index) │───▶│  (publishTime <= Cutoff)  │───▶│  (MAE, RMSE, Bias,  │  │
│  │   [fuelhh & windfor]      │    │  [48 SP alignment]        │    │   P10/P90 Quantiles)│  │
│  └───────────────────────────┘    └───────────────────────────┘    └──────────┬──────────┘  │
│                                                                               │             │
│  ┌────────────────────────────────────────────────────────────┐               │             │
│  │           Procurement "What-If" Decision Simulator         │◀──────────────┘             │
│  │           (Demand - Wind Forecast + Quantile Safety Buffer)│                             │
│  └────────────────────────────────────────────────────────────┘                             │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │ REST Endpoints (JSON over HTTP)
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  React Frontend (Vite + Vanilla CSS)                        │
│                                                                                             │
│  ┌───────────────────────────┐    ┌───────────────────────────┐    ┌─────────────────────┐  │
│  │  Trading Operations Desk  │    │  Forecast Accuracy Desk   │    │  What-If Simulator  │  │
│  │  - 48 SP Dual Curves      │    │  - Error Histograms       │    │  - Interactive Slid.│  │
│  │  - Delta Bars & Audit     │    │  - Diurnal Profile        │    │  - Cashout Savings  │  │
│  └───────────────────────────┘    └───────────────────────────┘    └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Directory Structure & File Manifest

```
uk-energy-dayahead-portal/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                     # FastAPI entrypoint, routes, and CORS setup
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── ingestion.py            # Elexon BMRS API ingestion & local SQLite caching
│   │       ├── alignment.py            # Point-in-time matching logic (zero lookahead)
│   │       ├── analytics.py            # Statistical metrics, quantiles, and diurnal profile
│   │       └── procurement.py          # What-if procurement simulator & cashout savings
│   ├── data/
│   │   ├── energy_data.db              # SQLite index (1,488 actuals, 19,272 forecasts)
│   │   ├── fuelhh_wind_jan2026.json    # Cached January 2026 actuals stream
│   │   └── windfor_jan2026.json        # Cached January 2026 forecasts stream
│   ├── tests/
│   │   ├── __init__.py
│   │   └── test_services.py            # Pytest test suite for alignment & metric logic
│   ├── Dockerfile                      # Production Docker container for backend
│   ├── pytest.ini                      # Pytest discovery configuration
│   └── requirements.txt                # Python backend dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── MetricCard.jsx          # Reusable KPI scorecard component
│   │   │   ├── TradingDesk.jsx         # 48 Settlement Periods curve & audit table
│   │   │   ├── AccuracyAnalytics.jsx   # Error distribution histograms & diurnal heatmaps
│   │   │   └── ProcurementSimulator.jsx# What-if thermal purchase slider simulator
│   │   ├── services/
│   │   │   └── api.js                  # Axios/fetch API client
│   │   ├── App.jsx                     # Top-level navigation, controls, and layout
│   │   ├── index.css                   # Custom Vanilla CSS institutional dark theme
│   │   └── main.jsx                    # React Vite entrypoint
│   ├── index.html                      # SEO-optimized HTML template
│   ├── package.json                    # Frontend dependencies (React, Recharts, Lucide)
│   ├── vite.config.js                  # Vite build configuration
│   └── Dockerfile                      # Multi-stage production Nginx container
├── docker-compose.yml                  # One-click multi-container orchestration
├── .dockerignore
├── .gitignore
└── README.md                           # System documentation
```

---

## 4. Key Analytical Findings (January 2026)

Evaluating the complete national-level generation for January 2026 reveals critical commercial insights:

| Metric | Measured Value | Commercial Trading Interpretation |
| :--- | :---: | :--- |
| **Total Settlement Periods** | **1,488 SPs** | Complete 31-day January outturn evaluated. |
| **Mean Absolute Error (MAE)** | **2,126.1 MW** | Average magnitude of forecast deviation from outturn. |
| **Root Mean Square Error (RMSE)** | **2,620.8 MW** | Quadratic metric reflecting exposure to large forecast swings. |
| **Mean Forecast Bias** | **+1,840.3 MW** | **Systematic Over-Forecasting:** Wind forecasts over-estimated actual generation by 15.9% on average. |
| **Weighted Absolute % Error (WAPE)**| **18.36%** | High-level aggregate forecast inaccuracy across the fleet. |
| **P90 Error Quantile** | **+4,340.0 MW** | In 90% of intervals, wind shortfall was under 4,340 MW, defining the optimal thermal buffer. |
| **Diurnal Bias Peak** | **14:00 - 18:00 UTC** | Forecasting uncertainty peaks during afternoon ramp-down hours. |

---

## 5. How to Start the Application

### Option A: Using Docker Compose (Recommended)
Ensure Docker is installed and running, then execute from the repository root:
```bash
docker compose up --build
```
* **Frontend:** Accessible at `http://localhost:3000`
* **Backend API:** Accessible at `http://localhost:8000`
* **Interactive API Docs:** `http://localhost:8000/docs`

---

### Option B: Local Development (Without Docker)

#### 1. Backend Setup (Python 3.10+)
```bash
cd backend

# Create and activate virtual environment (optional but recommended)
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run automated tests
pytest tests

# Start FastAPI server on port 8000
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Frontend Setup (Node.js 18+)
In a separate terminal:
```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
* Open your browser to `http://localhost:5173`.

---

## 6. Cloud Deployment Guide

### Deploy Backend (Render / Heroku)
1. Push this repository to GitHub.
2. In **Render** or **Heroku**, create a **Web Service** pointing to the `backend/` folder (or use the `backend/Dockerfile`).
3. Set environment variable: `PORT=8000`.
4. Deploy and note your public backend URL (e.g., `https://uk-energy-backend.onrender.com`).

### Deploy Frontend (Vercel)
1. Import the repository into **Vercel**.
2. Set Root Directory to `frontend`.
3. Add Environment Variable:
   ```
   VITE_API_URL=https://uk-energy-backend.onrender.com
   ```
4. Click **Deploy**.

---

## 7. Automated Testing Suite

Comprehensive unit tests validate both business logic and data engineering rules:
```bash
cd backend
pytest tests -v
```
**Test Coverage Includes:**
* `test_calculate_cutoff_timestamp`: Confirms $D-1$ cutoff calculation at gate closure hours.
* `test_available_dates`: Confirms all 31 days in January 2026 are present and correctly sorted.
* `test_aligned_day_data_structure`: Enforces zero lookahead bias (`publishTime <= cutoff`) across 48 Settlement Periods.
* `test_aggregate_analytics_metrics`: Validates formulas for MAE, RMSE, Mean Bias, and Quantiles ($P_{10}$ to $P_{90}$).
* `test_procurement_simulation`: Verifies thermal safety buffer calculations and cashout deficit reduction.

---

## 8. AI Tools Explicit Disclosure

In accordance with the challenge guidelines, AI tools were utilized to assist in building this application:
* **Google Antigravity IDE (powered by Gemini models)** was used as an AI pair-programmer for domain research on Elexon BMRS API specifications, designing the mathematical alignment algorithms, generating boilerplate React components, and structuring the analytical testing framework.

---

## 9. Video Presentation Walkthrough Outline

The submission includes a 10-minute unlisted YouTube video structured in two 5-minute parts:

### Part 1: Client Commercial Pitch (Head of Power Procurement)
* **0:00 - 1:00:** The Day-Ahead dilemma in the UK market—balancing volatile wind against consumer demand and the severe cost of cashout imbalance penalties.
* **1:00 - 2:30:** Live demonstration of the Trading Operations Desk: inspecting January 2026 settlement periods with locked D-1 11:00 UTC gate closure.
* **2:30 - 3:45:** Quantified Forecast Accuracy: uncovering the +1,840 MW systematic over-forecasting bias and how blindly following raw forecasts causes catastrophic shortages.
* **3:45 - 5:00:** The "What-If" Procurement Simulator: showing how applying a $P_{90}$ statistical buffer eliminates peak deficits and saves over £2M in cashout penalties on high-risk days.

### Part 2: Technical Lead Architecture & Code Review
* **5:00 - 6:00:** Decoupled architecture: FastAPI + React Vite + SQLite embedded caching for sub-20ms latency and 100% offline uptime resilience.
* **6:00 - 7:15:** Data engineering: Elexon `FUELHH` and `WINDFOR` integration, settlement period resolution handling (half-hourly vs hourly), and rigorous elimination of lookahead bias.
* **7:15 - 8:30:** Statistical mathematics: MAE, RMSE, WAPE, and quantile calculations in `analytics.py`, verified with automated pytest suites.
* **8:30 - 10:00:** DevOps and production readiness: Docker containerization, Vercel/Render deployment architecture, and extensibility for solar and intraday markets.
