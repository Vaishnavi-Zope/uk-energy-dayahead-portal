# UK Energy Day-Ahead Portal

A full-stack web application for visualizing, analyzing, and forecasting UK Day-Ahead renewable energy generation using Elexon BMRS data.

> **Live Deployment (Vercel):** [https://uk-energy-dayahead-portal.vercel.app](https://uk-energy-dayahead-portal.vercel.app) *(Update with your deployed Vercel link)*

---

## Features

- **Trading Desk**: Compare Day-Ahead wind generation forecasts against actual outturn across 48 half-hourly settlement periods (strictly enforcing the D-1 11:00 UTC gate closure).
- **Forecast Analytics**: Evaluate forecast error metrics including Mean Absolute Error (MAE), Root Mean Square Error (RMSE), bias distribution, and P10/P90 quantiles.
- **Procurement Simulator**: Interactive scenario simulator to calculate net thermal demand and determine optimal safety buffers to minimize cashout imbalance charges.

---

## Tech Stack

- **Frontend**: React 18, Vite, Recharts, Vanilla CSS
- **Backend**: Python 3.10+, FastAPI, SQLite, Pandas, NumPy
- **Data Source**: Elexon BMRS Open APIs (`FUELHH` actuals & `WINDFOR` forecasts for January 2026)

---

## Project Structure

```
uk-energy-dayahead-portal/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI routes & app entrypoint
│   │   └── services/
│   │       ├── ingestion.py            # Elexon API ingestion & SQLite caching
│   │       ├── alignment.py            # Point-in-time zero-lookahead alignment
│   │       ├── analytics.py            # MAE, RMSE, Bias, and quantile calculations
│   │       └── procurement.py          # What-if procurement decision simulator
│   ├── data/                           # Local January 2026 dataset & SQLite database
│   ├── Dockerfile                      # Backend container configuration
│   └── requirements.txt                # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/                 # TradingDesk, AccuracyAnalytics, Simulator
│   │   ├── services/api.js             # API client with offline fallback support
│   │   ├── data/fallbackData.json      # Bundled January 2026 offline dataset
│   │   ├── App.jsx                     # Root application component
│   │   └── index.css                   # Custom theme styling
│   ├── Dockerfile                      # Frontend container configuration
│   ├── package.json                    # Node dependencies
│   ├── vite.config.js                  # Vite configuration & dev proxy
│   └── vercel.json                     # Vercel deployment routing
├── docker-compose.yml                  # Multi-container orchestration
├── vercel.json                         # Root Vercel configuration
└── README.md                           # Documentation
```

---

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Python (3.10 or higher)

### Option 1: Docker (Recommended)

Run both services together with Docker Compose:

```bash
docker compose up --build
```

* **Frontend:** [http://localhost:3000](http://localhost:3000)
* **Backend API:** [http://localhost:8000](http://localhost:8000) (Swagger docs at `/docs`)

---

### Option 2: Local Setup

#### Backend Setup

1. Open a terminal and navigate to `backend`:
   ```bash
   cd backend
   ```
2. (Optional) Activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the server:
   ```bash
   python -m uvicorn app.main:app --reload --port 8000
   ```

#### Frontend Setup

1. In a separate terminal, navigate to `frontend`:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## AI Tools Disclosure

In accordance with the challenge guidelines, AI tools (Google Antigravity IDE powered by Gemini) were used to assist in domain research on Elexon BMRS specifications, algorithm implementation, and dashboard component structuring.
