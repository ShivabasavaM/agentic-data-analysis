# 📊 Agentic Data Analyst

An enterprise-grade, state-aware AI data analyst built with **LangGraph, FastAPI, React and Google Gemini**.

This system lets users query tabular data (CSV) in natural language. Instead of relying on the LLM to hallucinate arithmetic, it translates user intent into strict, deterministic Pandas operations. It features robust guardrails, dynamic schema injection and silent input sanitisation to prevent the classic "agentic loop of death".

| | |
| --- | --- |
| **Live demo** | https://agentic-data-analyser.vercel.app/ |
| **Backend API** | https://agentic-data-analysis.onrender.com |
| **API docs** | https://agentic-data-analysis.onrender.com/docs |

> **Cold start:** the backend runs on Render's free tier, which sleeps after about
> 15 minutes of inactivity. The first request can take 30–60 seconds while the
> service wakes. Subsequent questions are fast.

---

## 🎯 Project requirements and assessment criteria

Built to adhere to the following `project.md` requirements:

- **Restricted tool interface.** A restricted tool interface rather than arbitrary Python execution. The boundary between probabilistic reasoning and deterministic computation must be clear.
- **Single executable tool.** One robust executable tool, for efficiency and context limits.
- **Strict guardrails.** Rules preventing the LLM from fabricating columns, returning hallucinated metrics, or performing arithmetic itself.
- **Analytical capabilities.** Categorical filters, grouped statistics and date-based analysis.
- **Explainability.** A deterministic execution trace showing exactly how the LLM translated natural language into operations.
- **Robust error handling.** Ambiguous prompts, typos and dataset absence handled gracefully.
- **Security.** Prevention of arbitrary code execution and adversarial prompt injection.

---

## 🌟 Key architectural decisions

**Deterministic execution engine.** The LLM is forbidden from performing math. It acts purely as a reasoning router, passing structured tool arguments to a Pandas execution engine, which guarantees accurate aggregations.

**Silent input sanitisation.** Users make typos — *"what is the overral revenuew?"*. Rather than throwing a tool error and forcing the LLM into an expensive retry loop, the tool uses a `difflib`-powered interceptor that autocorrects to valid CSV columns at a 0.75 confidence cutoff and returns the right data on the first attempt.

**State-aware loop breaking.** To prevent runaway execution, the LangGraph state tracks `tool_call_count` and `failed_call_count`. A dedicated `loop_breaker` node halts execution when either limit is breached, surfacing the last successful intermediate result rather than discarding it.

**Pre-execution security screening.** A lightweight regex screening node (`screen_request`) intercepts adversarial prompts — attempts to run OS commands, drop tables or leak API keys — *before* invoking the LLM, saving token cost and closing the attack surface early.

**Dynamic schema and multi-tenancy.** The system reads the header of the active CSV at runtime and injects it into the system prompt. Custom `.csv` uploads are supported through the UI, with state isolated per `file_id` token.

---

## 🛠️ Tech stack

| Layer | Technology |
| --- | --- |
| AI orchestration | LangGraph, LangChain (`langchain-google-genai`) |
| LLM | Google Gemini (`gemini-3.5-flash`) |
| Backend | FastAPI, Python, Pandas, Pydantic |
| Frontend | React, Vite |
| Evaluation | Custom Python test suite (`test_evaluator.py`) |
| Hosting | Vercel (frontend), Render (backend) |

---

## 📂 Project structure

```
agentic-data-prototype/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py         # FastAPI endpoints (/chat, /upload, /health)
│   │   ├── agent/
│   │   │   ├── graph.py          # LangGraph state machine & loop logic
│   │   │   └── tools.py          # Pandas execution & typo middleware
│   │   ├── data/
│   │   │   └── project_2.csv     # Default assessment dataset
│   │   └── main.py               # Uvicorn entry point
│   ├── test_evaluator.py         # Comprehensive QA test suite
│   ├── requirements.txt
│   └── .env                      # Contains the Gemini API key
└── frontend/
    ├── src/
    │   ├── App.jsx               # React UI with file upload & chat interface
    │   └── main.jsx
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## 🚀 Getting started

### Prerequisites

- **Python** 3.10, 3.11 or 3.12. Python 3.14 is incompatible with the Pydantic V1 layer used by underlying libraries.
- **Node.js** for the Vite/React frontend.
- **API key** — a valid Google Gemini API key.

### 1. Backend setup

```bash
cd backend

# Create and activate a Python 3.12 virtual environment
python3.12 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install python-multipart google-generativeai

# Set your API key and model
echo "GOOGLE_API_KEY=your_actual_api_key_here" > .env
echo "GEMINI_API_KEY=your_actual_api_key_here" >> .env
echo "GEMINI_MODEL_NAME=gemini-3.5-flash" >> .env

# Start the FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API is available at `http://localhost:8000`, with interactive Swagger documentation at `http://localhost:8000/docs`.

### 2. Frontend setup

In a new terminal:

```bash
cd frontend

# Install Node modules
npm install

# Point the UI at your local backend
echo "VITE_API_URL=http://localhost:8000" > .env

# Start the Vite development server
npm run dev
```

The interface is available at `http://localhost:5173`. Start chatting with the default dataset immediately, or upload your own CSV.

---

## ⚙️ Environment variables

### Backend

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GOOGLE_API_KEY` | yes | — | Gemini credentials, read by `langchain-google-genai`. |
| `GEMINI_MODEL_NAME` | no | `gemini-3.5-flash` | Model name, so a version change needs no code edit. |
| `GEMINI_TEMPERATURE` | no | `0.0` | Deterministic planning. |
| `MAX_TOOL_CALLS` | no | `5` | Total tool calls allowed per question. |
| `MAX_FAILED_CALLS` | no | `2` | Repair attempts before the loop breaker fires. |

### Frontend

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Backend base URL. Vite only exposes `VITE_`-prefixed variables to the browser, and only at build time, so changing it requires a redeploy. |

---

## 🧪 Evaluation and testing

The repository includes a test suite that evaluates the agent against basic queries, grouped aggregations, date filtering, ambiguous prompts and adversarial attacks.

```bash
cd backend
source venv/bin/activate
python3 test_evaluator.py
```

The script prints a terminal summary (score and percentage) and writes `evaluation_report.csv` containing deterministic execution traces for debugging.

---

## 🔌 API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/upload` | Accepts a `multipart/form-data` `.csv` file. Returns a secure `file_id`. |
| `POST` | `/api/chat` | Accepts `{"query": "string", "file_id": "string", "thread_id": "string"}`. Returns the agent's deterministic answer and its execution trace. |
| `GET` | `/api/health` | System health check. Touches no model. |
| `GET` | `/docs` | OpenAPI documentation, generated by FastAPI. |

---

## ☁️ Deployment

**Backend — Render.** Deployed as a web service from `backend/`, with `/api/health` as the health check path. Environment variables are set in the Render dashboard, so the API key is never committed.

**Frontend — Vercel.** Deployed as a Vite project from `frontend/`, with `VITE_API_URL` set to the Render URL.

**Keeping it warm.** Render's free tier sleeps after roughly 15 minutes idle. A scheduled ping against `/api/health` every 10 minutes keeps the service responsive, and the free allowance of 750 hours per month covers one always-on service.