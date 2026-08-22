# Compounder Engine

Ranks US-listed companies on six data-driven pillars of business quality
(Quality · Growth · Durability · Capital Allocation · Financial Strength), then
overlays live valuation to produce a **BUY / WATCH / WAIT** call per company.

Fundamentals come from SEC EDGAR (reliable, free); only share price comes from a
market feed. Every score is traceable to a reported line item — no black boxes.

---

## Folder layout

```
cassandra/
├── pipeline/          # LOCAL, occasional: build the fundamentals from SEC
│   ├── extract_all.py       # companyfacts.zip -> master_financials.csv
│   ├── extract_metadata.py  # submissions.zip  -> company_metadata.csv
│   └── build_metrics.py     # master_financials -> company_summary.csv
│
├── backend/           # Render Web Service: API + weekly recompute
│   ├── app.py               # FastAPI + APScheduler (weekly) + /api/refresh
│   ├── pipeline.py          # scoring -> prices -> valuation (NO SEC)
│   ├── metrics.py score.py valuation.py
│   ├── requirements.txt
│   └── data/
│       ├── company_summary.csv    # static fundamentals (committed)
│       ├── company_metadata.csv   # static (committed)
│       └── dashboard.json         # regenerated weekly (served to UI)
│
├── frontend/          # Render Static Site: React + Vite + Tailwind app
│   ├── src/
│   │   ├── pages/           # Screen, Weight Lab, Method
│   │   ├── components/      # Layout, CompanyDrawer, Pill, Meter, StatTile
│   │   ├── api.ts types.ts  # typed API client
│   │   └── lib/             # formatters, theme
│   ├── package.json vite.config.ts tailwind.config.js
│   └── index.html
│
├── render.yaml        # Blueprint: deploys both services
└── .gitignore
```

## Frontend (React + Vite + Tailwind)

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173  (proxies /api -> localhost:8000)
```

Pages: **Screen** (the ranked table + filters + detail drawer), **Weight Lab**
(live re-ranking by pillar weights — next milestone), **Method**. The API base
is `VITE_API_BASE` (empty in dev uses the Vite proxy; set to the backend URL for
production builds).

**Why the split:** SEC fundamentals change ~annually and the source data is
gigabytes. The weekly refresh only needs **price → valuation → recommendation**,
so the backend ships the small pre-computed fundamentals and never touches EDGAR.
Re-running the SEC extraction (the `pipeline/` scripts) is a manual, occasional
local job.

---

## The two data cadences

| Cadence | What runs | Where |
|---|---|---|
| **Occasional** (new SEC filings) | `pipeline/` scripts → refresh `company_summary.csv` + `company_metadata.csv`, copy into `backend/data/`, commit | Local |
| **Weekly** (prices move) | `backend/pipeline.py` → new prices, valuations, calls | Render (auto) |

---

## Local development

```bash
# one-time: rebuild fundamentals from SEC bulk files (needs the .zip files present)
cd pipeline
python extract_all.py          # -> master_financials.csv
python extract_metadata.py     # -> company_metadata.csv
python build_metrics.py        # -> company_summary.csv
# copy the two small CSVs the backend needs:
cp company_summary.csv company_metadata.csv ../backend/data/

# run the backend locally
cd ../backend
pip install -r requirements.txt
python pipeline.py             # compute once -> data/dashboard.json
uvicorn app:app --reload       # API at http://localhost:8000

# open the frontend
# edit frontend/index.html -> set API_BASE to http://localhost:8000, then open it
```

---

## Deploy on Render (two services)

1. Push this folder to a GitHub repo (the `.gitignore` keeps the giant SEC files out).
2. Render → **New → Blueprint** → pick the repo. `render.yaml` creates both:
   - **compounder-api** (web service, API + weekly scheduler, 1 GB persistent disk)
   - **compounder-ui** (static site, the dashboard)
3. After first deploy:
   - Copy the backend URL (e.g. `https://compounder-api.onrender.com`).
   - Set the frontend's `API_BASE` to it — either edit `frontend/index.html`, or
     uncomment the `sed` build command in `render.yaml`.
   - Set the backend's `ALLOWED_ORIGINS` env var to the frontend URL.
4. Done. The backend computes on boot and every **Monday 09:00 UTC**; the UI
   fetches from `/api/companies`.

### API
| Endpoint | Purpose |
|---|---|
| `GET /api/health` | liveness + whether data is ready |
| `GET /api/status` | last-updated timestamp + recommendation counts |
| `GET /api/companies` | the full screen (JSON the UI renders) |
| `POST /api/refresh` | manual recompute (needs `x-refresh-token` header) |

### Scheduling notes
- The backend schedules itself with APScheduler. On Render's **free** plan the
  service sleeps when idle, which can skip the job — use the **starter** plan to
  keep it reliable, or enable the dedicated **Cron Job** block in `render.yaml`
  (it pings `/api/refresh` weekly regardless of sleep).

---

## Method (one line each)
- **Scores are percentile ranks within sector** — a bank is judged against banks.
- **Data-confidence gate**: companies we lack data on are quarantined, never scored.
- **Valuation is a separate axis** — it decides *when*, not *whether*, it's a compounder.
- **Durability = persistence** — high returns and stable margins that didn't mean-revert.
