# UK Energy Day-Ahead Portal

A full-stack web application for visualizing, analyzing, and forecasting UK Day-Ahead renewable energy generation using Elexon BMRS data.

## Features

- **Trading Desk**: Compare Day-Ahead wind generation forecasts against actual outturn across 48 half-hourly settlement periods.
- **Forecast Analytics**: Evaluate forecast error metrics including Mean Absolute Error (MAE), Root Mean Square Error (RMSE), and bias distribution.
- **Procurement Simulator**: Interactive scenario simulator to calculate net demand and determine optimal procurement buffers to minimize imbalance risk.

## Tech Stack

- **Frontend**: React, Vite, Recharts, Vanilla CSS
- **Backend**: Python, FastAPI, SQLite, Pandas, NumPy
- **Data**: Elexon BMRS API (`FUELHH` and `WINDFOR` datasets)

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Python (3.10 or higher)

### Backend Setup

1. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```

2. (Optional) Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the FastAPI development server:
   ```bash
   python -m uvicorn app.main:app --reload --port 8000
   ```
   The API will be available at `http://localhost:8000` (Swagger docs at `http://localhost:8000/docs`).

### Frontend Setup

1. In a separate terminal, navigate to the frontend folder:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite dev server:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:5173`.

### Docker (Optional)

To run both services together using Docker:
```bash
docker compose up --build
```
