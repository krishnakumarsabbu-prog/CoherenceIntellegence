# CoherenceIQ — Fraud Detection Pipeline Studio

A composable, visual fraud-detection pipeline studio. Analysts drag-and-drop
nodes onto a canvas, wire them into a directed acyclic graph (DAG), configure
each algorithm's parameters, and execute the pipeline against a dataset —
streaming live node-by-node progress over WebSockets while a real ML engine
scores transactions and produces evaluation metrics.

> **Product thesis.** The pipeline canvas stays generic and composable — the
> user builds their *own* detection pipeline at runtime instead of running one
> hardcoded fraud flow. That composability is the product's edge over a static
> rules engine.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Repository Layout](#repository-layout)
3. [High-Level Architecture](#high-level-architecture)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Execution Flow (End-to-End)](#execution-flow-end-to-end)
7. [WebSocket Streaming Protocol](#websocket-streaming-protocol)
8. [Database Schema](#database-schema)
9. [Algorithm Registry](#algorithm-registry)
10. [REST API Reference](#rest-api-reference)
11. [Pipeline Node Catalog](#pipeline-node-catalog)
12. [Recommendation Engine](#recommendation-engine)
13. [Live Inference Flow](#live-inference-flow)
14. [Running Locally](#running-locally)
15. [Wiki / Glossary](#wiki--glossary)

---

## Tech Stack

| Layer | Technology |
|------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State | Zustand (UI/app state), TanStack Query (server data) |
| Canvas | @xyflow/react (React Flow) |
| Charts | Recharts |
| Animation | Framer Motion |
| Routing | react-router-dom v6 |
| Backend | FastAPI (Python), Uvicorn |
| Persistence | SQLite (WAL mode) |
| Real-time | WebSockets |
| ML engine | scikit-learn, XGBoost (optional), scipy, pandas, numpy |

---

## Repository Layout

```
project/
├── index.html                      # Vite entry; loads Inter font, mounts #root
├── vite.config.ts                  # Dev server on :5173, proxies /api → :8000 (ws + http)
├── package.json
├── tailwind.config.js
├── src/
│   ├── main.tsx                    # React root: BrowserRouter + QueryClientProvider
│   ├── App.tsx                     # Route table + RequireAuth guard
│   ├── index.css                   # Tailwind directives + design tokens
│   ├── store/
│   │   └── appStore.ts             # Zustand: user, theme, sidebar collapse
│   ├── config/
│   │   └── nav.tsx                 # Sidebar nav items + inline SVG icons
│   ├── data/
│   │   └── algorithms.ts           # (legacy) static algorithm metadata
│   ├── hooks/
│   │   └── useDashboardData.ts
│   ├── mocks/
│   │   └── dashboard.ts
│   ├── components/layout/
│   │   ├── AppLayout.tsx           # Sidebar + Header + <Outlet/>
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── AlgorithmLibraryPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── PlaceholderPage.tsx     # Used for unbuilt routes (e.g. Reports)
│   └── features/
│       ├── pipelineStudio/         # The canvas / DAG builder
│       │   ├── PipelineStudioPage.tsx
│       │   ├── pipelineStore.ts    # Zustand: nodes, edges, selection, toasts
│       │   ├── catalog.ts          # Node palette definitions + category colors
│       │   ├── algorithmApi.ts     # TanStack Query hooks → /api/algorithms/*
│       │   ├── types.ts
│       │   └── components/
│       │       ├── NodePalette.tsx
│       │       ├── PipelineNode.tsx
│       │       ├── CanvasToolbar.tsx
│       │       ├── PropertiesPanel.tsx
│       │       ├── NodeContextMenu.tsx
│       │       └── ToastStack.tsx
│       ├── executionConsole/       # Run pipelines, stream results live
│       │   ├── ExecutionConsolePage.tsx
│       │   ├── executionStore.ts
│       │   ├── api.ts              # fetch + WebSocket client → /api/*
│       │   ├── types.ts
│       │   └── components/
│       │       ├── LivePipelineGraph.tsx
│       │       ├── LiveNode.tsx
│       │       ├── LogPanel.tsx
│       │       ├── ResultsPanel.tsx
│       │       ├── NodeDetailModal.tsx
│       │       └── SuggestedOptimizations.tsx
│       └── pipelineComparison/     # A/B compare pipelines + recommendations
│           ├── PipelineComparisonPage.tsx
│           ├── api.ts
│           └── types.ts
└── backend/
    ├── run.py                      # `python run.py` → uvicorn app.main:app
    ├── data/
    │   ├── coherenceiq.db          # SQLite database (auto-created)
    │   └── sample_transactions.json
    └── app/
        ├── __init__.py
        ├── main.py                 # FastAPI app: routes, WebSocket, in-memory queues
        ├── db.py                   # SQLite layer (executions, datasets, pipelines)
        ├── executor.py             # Topological walk + live ML execution engine
        ├── models_engine.py        # Real scikit-learn / XGBoost model execution
        ├── algorithms.py           # AlgorithmRegistry (40 algorithms, param schemas)
        ├── dataset.py              # Sample data, CSV parsing, Markdown rule ingestion
        ├── markdown_rule_engine.py# Markdown → RuleAST → synthetic event stream
        └── recommendations.py      # Rule-based suggested-optimization engine
```

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         BROWSER (Client)                              │
│                                                                       │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────────┐   │
│  │  React UI   │   │  Zustand     │   │  TanStack Query          │   │
│  │  (pages +   │←→ │  appStore /  │   │  (server cache for       │   │
│  │   features) │   │  pipeline /  │   │   /algorithms/*)         │   │
│  │             │   │  execution   │   │                          │   │
│  └──────┬──────┘   └──────┬───────┘   └───────────┬──────────────┘   │
│         │                 │                       │                   │
│         │   React Flow canvas (@xyflow/react)     │                   │
│         │   for DAG composition & live rendering  │                   │
│         │                 │                       │                   │
│         ▼                 ▼                       ▼                   │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │            fetch()  →  /api/*        (REST)                   │    │
│  │            WebSocket → /api/ws/executions/{id}  (live stream) │    │
│  └──────────────────────────────┬───────────────────────────────┘    │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │  Vite dev proxy (:5173 → :8000)
                                  │  ws: true, rewrite /api → /
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      FASTAPI BACKEND  (:8000)                         │
│                                                                       │
│  ┌─────────────────── main.py ──────────────────────────────────┐     │
│  │  REST endpoints          WebSocket endpoint                 │     │
│  │  /algorithms, /pipelines, /ws/executions/{id}                │     │
│  │  /executions, /datasets,  /pipelines/compare, /predict        │     │
│  │                                                               │     │
│  │  In-memory: _live_queues, _replay, _results_cache, _tasks     │     │
│  └──────┬──────────────────┬──────────────────┬──────────────────┘     │
│         │                  │                  │                         │
│         ▼                  ▼                  ▼                         │
│  ┌────────────┐    ┌──────────────┐    ┌───────────────────┐             │
│  │  db.py     │    │  executor.py │    │  algorithms.py    │             │
│  │  SQLite    │    │  topo walk + │    │  REGISTRY (40     │             │
│  │  CRUD      │    │  live ML     │    │  algorithms)      │             │
│  └─────┬──────┘    └──────┬───────┘    └───────────────────┘             │
│        │                  │                                              │
│        │                  ▼                                              │
│        │           ┌──────────────────────┐  ┌────────────────────┐     │
│        │           │  models_engine.py    │← │  dataset.py         │     │
│        │           │  sklearn / XGBoost   │  │  sample + CSV + MD   │     │
│        │           │  real ML execution   │  └─────────┬──────────┘     │
│        │           └──────────────────────┘            │                │
│        │                                             ▼                │
│        │                          ┌──────────────────────────────┐      │
│        │                          │ markdown_rule_engine.py      │      │
│        │                          │ .md → RuleAST → event stream  │      │
│        │                          └──────────────────────────────┘      │
│        ▼                                                                │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  SQLite  (backend/data/coherenceiq.db, WAL mode)                │    │
│  │  tables: executions, datasets, pipelines                         │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  recommendations.py  (rule-based suggested optimizations)      │    │
│  └────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Routing & Auth

`src/main.tsx` mounts the app under `BrowserRouter` + `QueryClientProvider`.
`App.tsx` defines the route table:

```
/login                         LoginPage        (public)
└── <RequireAuth>              ← guards all routes below; redirects to /login
    ├── /dashboard             DashboardPage
    ├── /pipeline-studio       PipelineStudioPage      (Phase 2)
    ├── /algorithm-library     AlgorithmLibraryPage     (Phase 3)
    ├── /execution-console     ExecutionConsolePage     (Phase 4)
    ├── /pipeline-comparison   PipelineComparisonPage   (Phase 5)
    ├── /reports               PlaceholderPage          (Phase 5, stub)
    └── /settings              SettingsPage
*                              → redirect to /dashboard
```

`RequireAuth` reads `user` from the Zustand `appStore`; if absent it redirects
to `/login` preserving the intended destination in router state.

### State management — two layers

1. **Zustand stores** (client UI state, never server data):
   - `appStore` — `user`, `theme` (light/dark, persisted to localStorage),
     `sidebarCollapsed`.
   - `pipelineStore` — React Flow `nodes` / `edges`, selected node id, toast
     stack, save/load state for the canvas.
   - `executionStore` — current execution id, live WS messages, results.

2. **TanStack Query** (server data, cached):
   - `useAlgorithmsForCategory(category)` → `GET /api/algorithms/{category}`
   - `useAllAlgorithmsWithDetails()` → `GET /api/algorithms?full=true`
   - `useAlgorithmDetail(id)` → `GET /api/algorithms/{id}`

### Pipeline Studio (the canvas)

Built on **@xyflow/react**. The node palette (`catalog.ts`) defines five
categories — `input`, `preprocessing`, `feature`, `detection`, `output` — each
with its own accent color. Detection nodes carry a `detectionSubType`
(`clustering` | `anomaly` | `classification`) that determines which algorithm
category is fetched from the backend when the user opens the properties panel.

The pipeline is serialized as `{ nodes: PipelineNode[], edges: PipelineEdge[] }`
where each `PipelineNode.data` carries `category`, `defType`, `algorithmId`,
`params`, `description`, and `notes`. This JSON is what gets POSTed to the
backend for execution and saved to SQLite via `POST /api/pipelines`.

### Execution Console

The console calls `startExecution()` (REST) to kick off a run, then
`openExecutionSocket()` opens a WebSocket to `/api/ws/executions/{id}`. Each
incoming `WsMessage` updates the live node graph (running → complete), appends
to the log panel, and — on `type: "complete"` — populates the results panel
with summary metrics, score distribution, flagged rows, and node telemetry.

### Pipeline Comparison

Sends 2–3 saved pipelines + a dataset ref to `POST /api/pipelines/compare`,
which runs each pipeline server-side and returns per-pipeline summaries. After
a run, the page calls `POST /api/pipelines/recommendations` to fetch
rule-based optimization suggestions.

---

## Backend Architecture

### FastAPI app (`backend/app/main.py`)

Single-process FastAPI application. On startup it calls `db.init_db()` which
creates the SQLite tables and seeds a default "Enterprise Fraud & Risk Mega
Pipeline" if none exist.

**In-memory state** (process-local; SQLite remains source of truth):

| Symbol | Purpose |
|--------|---------|
| `_live_queues` | `exec_id → set[asyncio.Queue]` for connected WS clients |
| `_replay` | `exec_id → list[msg]` buffer so late clients see full history |
| `_results_cache` | `exec_id → final results dict` (fast fetch after completion) |
| `_tasks` | `exec_id → asyncio.Task` for the running execution |

### Execution engine (`backend/app/executor.py`)

`run_pipeline()` is an **async generator** that:

1. Resolves the dataset (custom Markdown rules → uploaded CSV → sample).
2. Performs a **topological sort** of the DAG (`_topo_order`).
3. Walks nodes in order, yielding live `node` / `log` messages after each.
4. Dispatches each node to the real ML engine in `models_engine.py`:
   - `input` → load rows
   - `preprocessing` → `execute_preprocessing()`
   - `feature` → `execute_feature_engineering()`
   - `detection` → `execute_detection_model()` (collects per-node scores)
5. After the walk, `_build_results()` combines all detection-node scores into
   final flagged rows, computes TP/FP/TN/FN, precision, recall, F1, FPR, score
   distribution buckets, and per-node telemetry.
6. Yields a final `complete` message with the full results object.

### ML engine (`backend/app/models_engine.py`)

Executes **real** scikit-learn / XGBoost models, not simulations:

- **Preprocessing** — cleaning, median/mode imputation, MinMax normalization,
  deduplication.
- **Feature engineering** — velocity features, aggregation windows, mutual
  information selection, PCA, chi-square, target encoding, polynomial
  features, TF-IDF, frequency encoding, robust scaling.
- **Clustering** — DBSCAN, HDBSCAN, KMeans, Agglomerative, GMM, OPTICS,
  Spectral, Bisecting KMeans, Mean Shift, Graph-community (kNN proxy).
- **Anomaly detection** — Isolation Forest, LOF, Autoencoder (SVD bottleneck),
  One-Class SVM, Elliptic Envelope (MCD), COPOD, HBOS, PCA anomaly, k-NN
  outlier, Deep SVDD (SVD proxy).
- **Classification** — XGBoost (falls back to HistGradientBoosting if xgboost
  not installed), LightGBM, Logistic Regression, Random Forest, Extra Trees,
  MLP, Gradient Boosting, SVC, Naive Bayes, AdaBoost.

All raw scores are normalized to `[0, 1]` via `_normalize_scores()`.

### Markdown rule engine (`backend/app/markdown_rule_engine.py`)

Parses arbitrary `.md` rule spec documents into `RuleAST` dataclasses (rule
id, description, parameter count, parameters, conditions, risk level). Then
`generate_event_stream_from_rules()` synthesizes a transaction event stream
*derived from the uploaded rules* — populating columns for every declared
parameter and evaluating rule-firing status per row. This lets analysts bring
their own business rules and immediately exercise them through the pipeline.

### Recommendation engine (`backend/app/recommendations.py`)

A **heuristic, rule-based** lookup (not ML). Each rule has a `match(pipeline,
summary)` predicate over the graph structure and summary metrics. Triggered
rules become suggestions like "Try XGBoost for imbalanced data" or "Add a
feature engineering step", each with an estimated metric delta.

---

## Execution Flow (End-to-End)

```
 USER ACTION                  FRONTEND                       BACKEND
─────────────  ───────────────────────────  ───────────────────────────────────
 1. Drag nodes   Pipeline Studio canvas
    onto canvas  (React Flow)
 2. Wire edges   drag from handle → handle
 3. Open         PropertiesPanel →
    Properties   useAlgorithmDetail(id)
                  GET /api/algorithms/{id}  →  algorithms.py returns schema
 4. Set params   form writes to node.data.params
 5. Save         POST /api/pipelines        →  db.save_pipeline() → SQLite
 6. Click Run    ExecutionConsolePage
                  POST /api/pipelines/{id}/execute
                                            →  db.insert_execution()
                                            →  asyncio.create_task(
                                                 _run_execution())
                                            ←  { execution_id, status:"queued" }
 7. Open socket  openExecutionSocket(id)
                  WS /api/ws/executions/{id} →  replay buffered msgs,
                                            →  stream live msgs as they
                                               arrive from run_pipeline()
 8. Stream       run_pipeline() async-gen:
    live            for node in topo_order:
                       yield "node running"
                       execute ML (models_engine)
                       yield "node complete" + telemetry
                   yield "complete" + results
                        │
                        ▼  _broadcast() → all WS queues
                        ▼  _replay[id].append(msg)
                        ▼  on complete: _results_cache[id] = results
                                       db.update_execution_status(
                                         "completed", summary)
 9. Render       LogPanel appends msgs
    results      LiveNode flips running→complete
                ResultsPanel shows summary, charts, flagged rows
                SuggestedOptimizations →
                  POST /api/pipelines/recommendations
                                            →  recommendations.py
                                            ←  { suggestions: [...] }
```

---

## WebSocket Streaming Protocol

Endpoint: `WS /api/ws/executions/{exec_id}` (also `/api/ws/executions/{id}`
via the Vite proxy).

**Connection lifecycle**

1. Server accepts the socket and adds a new `asyncio.Queue` to
   `_live_queues[exec_id]`.
2. Server replays the full `_replay[exec_id]` buffer (so a late client sees
   the entire history).
3. If the execution already finished (`exec_id in _results_cache`), the server
   sends the buffered messages and closes — no live streaming needed.
4. Otherwise the server forwards each new message as it is broadcast by the
   running task, until a `complete` or `error` message arrives, then closes.

**Message shapes** (mirrored by `WsMessage` in `src/features/executionConsole/types.ts`):

```ts
// node status change
{ type: "node", node_id, node_label, node_status: "running"|"complete",
  category, message, timestamp }

// informational / error log line
{ type: "log", level: "info"|"error", message, node_id, node_status, timestamp }

// final results
{ type: "complete", message, results: ExecutionResults, timestamp }

// fatal error
{ type: "error", message, timestamp }
```

---

## Database Schema

SQLite at `backend/data/coherenceiq.db` (WAL journal mode, 5s busy timeout).
Created by `db.init_db()` on startup.

```sql
CREATE TABLE executions (
    id            TEXT PRIMARY KEY,          -- exec-<12hex>
    pipeline_id   TEXT NOT NULL,
    pipeline_name TEXT NOT NULL,
    pipeline_json TEXT NOT NULL,            -- full DAG snapshot at run time
    dataset_ref   TEXT,
    status        TEXT NOT NULL,             -- queued | running | completed | failed
    started_at    TEXT NOT NULL,             -- ISO 8601 UTC
    completed_at  TEXT,
    summary_json  TEXT,                      -- metrics summary on completion
    created_at    TEXT NOT NULL
);
CREATE INDEX idx_exec_started   ON executions(started_at DESC);
CREATE INDEX idx_exec_pipeline  ON executions(pipeline_id);

CREATE TABLE datasets (
    id          TEXT PRIMARY KEY,           -- upload-<8hex> | sample-txns-001
    name        TEXT NOT NULL,
    source      TEXT NOT NULL,              -- upload | sample | markdown_rules
    row_count   INTEGER NOT NULL,
    created_at  TEXT NOT NULL,
    path        TEXT,
    rows_json   TEXT                         -- full row payload (JSON)
);

CREATE TABLE pipelines (
    id          TEXT PRIMARY KEY,            -- pipe-<8hex> | pipe_enterprise_mega_001
    name        TEXT NOT NULL,
    description TEXT,
    nodes_json  TEXT NOT NULL,              -- React Flow nodes
    edges_json  TEXT NOT NULL,              -- React Flow edges
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
```

All writes are guarded by a process-wide `threading.RLock` and use
parameterized queries. `save_pipeline` uses `INSERT ... ON CONFLICT DO UPDATE`
for upsert.

---

## Algorithm Registry

`backend/app/algorithms.py` is the **single source of truth** for algorithm
metadata. It exposes 40 algorithms across four categories, each with a full
parameter schema (name, type, default, min/max/step, options, hint):

| Category | Count | Examples |
|----------|------:|----------|
| feature-engineering | 10 | Velocity Features, Aggregation Window, Mutual Information Selection, PCA, Chi-Square, Target Encoding, Polynomial, TF-IDF, Frequency Encoding, Robust Scaler |
| clustering | 10 | DBSCAN, HDBSCAN, Graph Community, KMeans, Agglomerative, GMM, OPTICS, Spectral, Bisecting KMeans, Mean Shift |
| anomaly-detection | 10 | Isolation Forest, LOF, Autoencoder, One-Class SVM, Elliptic Envelope, COPOD, HBOS, PCA Anomaly, k-NN Outlier, Deep SVDD |
| classification | 10 | XGBoost, LightGBM, Logistic Regression, Random Forest, CatBoost, SVC, Naive Bayes, Extra Trees, MLP, Gradient Boosting |

Exposed via:
- `GET /api/algorithms` → categories (or full registry with `?full=true`)
- `GET /api/algorithms/{category}` → algorithms in a category
- `GET /api/algorithms/{id}` → single algorithm with full parameter schema

---

## REST API Reference

All routes are mounted twice — once at the root path and once under `/api`
(so the Vite proxy and direct backend access both work).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness probe |
| GET | `/algorithms` | List categories (or full registry with `?full=true`) |
| GET | `/algorithms/{key}` | Algorithm detail (if id) or category list (if category) |
| GET | `/datasets/sample` | Sample transaction dataset metadata |
| GET | `/datasets/sample-markdown` | Sample Markdown rules dataset metadata |
| POST | `/datasets/upload` | Upload CSV or `.md` file → parsed dataset |
| GET | `/pipelines` | List saved pipelines (seeds default if empty) |
| POST | `/pipelines` | Create / update a pipeline (upsert by id) |
| GET | `/pipelines/{id}` | Fetch one pipeline |
| DELETE | `/pipelines/{id}` | Delete one pipeline |
| POST | `/pipelines/{id}/execute` | Start async execution → returns `execution_id` |
| WS | `/ws/executions/{id}` | Live execution stream (with replay buffer) |
| GET | `/executions/{id}` | Execution record (+ cached results if complete) |
| GET | `/executions` | List recent executions (default limit 50) |
| POST | `/pipelines/compare` | Run 2–3 pipelines against one dataset, return summaries |
| POST | `/pipelines/recommendations` | Rule-based optimization suggestions for a run |
| POST | `/api/pipeline/predict` | Live real-time inference on a single transaction |

---

## Pipeline Node Catalog

Five categories, each color-coded in the palette and on the canvas:

```
INPUT (blue)              PREPROCESSING (teal)    FEATURE (violet)
├─ Transaction Feed       ├─ Cleaning              ├─ Feature Engineering
├─ CSV Upload             ├─ Missing Values        │   (algorithmId selects one
├─ Markdown Rules (.md)   ├─ Normalization         │    of 10 feature algos)
├─ REST API               └─ Deduplication
└─ Kafka Stream

DETECTION (amber)         OUTPUT (rose)
├─ Clustering             ├─ Flag for Review
│  (10 clustering algos)  ├─ Auto-Block
├─ Anomaly Detection      ├─ Webhook Alert
│  (10 anomaly algos)     └─ Case Management Export
└─ Classification
   (10 classification algos)
```

A detection node's `detectionSubType` maps to a backend algorithm category
via `categoryForNode()` in `algorithmApi.ts`:

```
feature            → feature-engineering
detection/clustering    → clustering
detection/anomaly       → anomaly-detection
detection/classification → classification
```

---

## Recommendation Engine

`backend/app/recommendations.py` evaluates a fixed table of heuristic rules
against the pipeline graph + summary metrics. Each rule has a `match(pipeline,
summary)` predicate. Current rules:

| id | Trigger | Suggestion |
|----|---------|-----------|
| `swap-logistic-for-boosting` | Logistic Regression node with F1 < 0.7 and no upstream imbalance handling | Try XGBoost / LightGBM (est. F1 +0.08–0.15) |
| `swap-kmeans-for-density` | KMeans node with geo/velocity features upstream | Try DBSCAN / HDBSCAN (est. recall +0.05–0.12) |
| `add-feature-engineering` | Detection node with no upstream feature node | Add a Feature Engineering step (est. F1 +0.04–0.10) |
| `high-fpr-isolation-lof` | `false_positive_rate > 0.15` | Tune Isolation Forest / LOF to stricter contamination (est. FPR −40–60%) |

Rules are isolated: a single failing `match()` is swallowed and never breaks
the run.

---

## Live Inference Flow

`POST /api/pipeline/predict` enables real-time scoring of an individual
transaction against a configured pipeline:

```
Client posts { pipeline, transaction }
        │
        ▼
  main.py predict_pipeline()
        │  extracts custom Markdown rules from input node params
        ▼
  markdown_rule_engine.parse_markdown_rules_ast()
        │  builds RuleAST list
        ▼
  for each rule:
    match transaction keys against rule parameters
    flag if amount > 800 or rule.risk_level == "HIGH"
        ▼
  compute is_fraud, risk_score, decision
        │  decision = BLOCK (≥0.8) | CHALLENGE (≥0.45) | ALLOW
        ▼
  return { is_fraud, risk_score, decision,
           triggered_rules, matched_clusters,
           execution_time_ms, transaction_id }
```

---

## Running Locally

### Backend

```bash
cd backend
pip install fastapi uvicorn pandas numpy scipy scikit-learn xgboost python-multipart
python run.py          # uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The SQLite database at `backend/data/coherenceiq.db` is auto-created on first
startup, and a default "Enterprise Fraud & Risk Mega Pipeline" is seeded.

### Frontend

```bash
npm install
npm run dev            # Vite on :5173, proxies /api → :8000
```

Open `http://localhost:5173`. Sign in (the login page sets a mock user in the
Zustand store; no backend auth is required for local dev).

### Build

```bash
npm run build          # tsc -b && vite build
npm run typecheck      # tsc -b --noEmit
```

---

## Wiki / Glossary

### Pipeline
A directed acyclic graph (DAG) of nodes representing a fraud-detection
workflow. Serialized as `{ nodes, edges }` and persisted in the `pipelines`
SQLite table.

### Node
A single processing step in a pipeline. Belongs to one of five categories
(input, preprocessing, feature, detection, output). Carries a `defType`
(template id), optional `algorithmId` (concrete algorithm), and `params`
(algorithm parameter values).

### Edge
A directed connection between two nodes, defining data flow. The executor
topologically sorts nodes by edges before execution.

### Execution
A single run of a pipeline against a dataset. Recorded in the `executions`
table with status progression `queued → running → completed | failed`.

### Detection sub-type
Detection nodes are sub-grouped into `clustering`, `anomaly`, or
`classification`, which determines which algorithm category the backend
serves for the properties panel dropdown.

### Telemetry
Per-node execution metadata captured during a run: inflow/outflow row counts,
filtered count, execution time, columns, sample records, and detailed
algorithm-specific outputs (feature importances, clusters, attributions).

### Flagged row
A transaction whose best detection score exceeds the flagging threshold.
Threshold is derived from the node's `threshold` param, or computed from the
`contamination` percentile, defaulting to 0.5.

### Risk tier
Each flagged row is assigned `CRITICAL` (score ≥ 0.85), `HIGH` (≥ 0.65), or
`MEDIUM`, with a human-readable `fraud_reason` string enumerating the signals
that fired (amount, velocity, geo-velocity, device risk, multi-signal
consensus).

### Markdown rules
Business rule specifications authored as Markdown (`.md`) files. The engine
parses them into a Rule AST (rule id, description, parameters, conditions,
risk level) and synthesizes an evaluation event stream derived from those
rules — so analysts can bring their own rule documents and immediately
exercise them through the pipeline.

### Replay buffer
An in-memory list (`_replay[exec_id]`) of every message emitted by a run. A
WebSocket client that connects mid-run receives the full buffer first, then
live messages, so late clients never miss history.

### Results cache
An in-memory dict (`_results_cache[exec_id]`) holding the final results object
after a run completes. Enables fast `GET /executions/{id}` fetches without
re-deriving metrics from SQLite. SQLite remains the durable source of truth.

### Comparison
Running 2–3 pipelines against the same dataset and returning each one's
summary metrics side-by-side, so analysts can pick the best-performing
configuration.

### Recommendation
A heuristic suggestion (not ML) generated by inspecting the pipeline graph
and summary metrics — e.g. "swap KMeans for HDBSCAN", "add a feature
engineering step". Each carries an estimated metric delta.

### Predict
Real-time single-transaction inference. The pipeline's Markdown rules are
parsed, the incoming transaction is matched against rule parameters, and a
decision (`BLOCK` / `CHALLENGE` / `ALLOW`) plus risk score are returned in
milliseconds.
