# CourseWeave AI

An AI-powered course recommendation system for Northeastern University graduate students. The system combines real job market data, structured academic data, and a full RAG retrieval pipeline to suggest personalized course paths based on a student's completed courses, career goals, and degree requirements.

---

## Architecture Overview

```
Student Query
    |
    v
Postgres Pre-filter       -- completed courses, eligible courses, prerequisites,
    |                        degree audit, credit tracking, path selection
    v
Query Builder             -- reads careers.json (Adzuna + Gemini enriched)
    |                        builds skill-based search query
    v
Pinecone Hybrid Search    -- dense (BGE-small-en-v1.5) + sparse (BM25)
    |                        native dotproduct fusion on courseweave-hybrid index
    v
Cross-Encoder Reranking   -- ms-marco-MiniLM-L-6-v2
    |                        uses HyDE hypothesis text for scoring
    v
MMR Diversity             -- penalizes overlap with completed courses
    |                        and among selected recommendations
    v
Guardrails                -- double check: eligible only + not completed
    |
    v
Gemini 2.5 Flash          -- conversational explanation with degree context
    |                        exponential backoff retry on rate limits
    v
Student Recommendation
```

---

## Project Structure

```
courseweave-ai/
|
|-- Data-Pipeline/                    # Airflow DAG + data ingestion
|   |-- dags/pipeline_dag.py          # 8-task Airflow pipeline
|   |-- scripts/
|   |   |-- acquire_data.py
|   |   |-- preprocess_data.py
|   |   |-- validate_data.py
|   |   |-- load_data.py
|   |   |-- detect_anomalies.py
|   |   |-- pdf-extract.py            # GCS PDFs -> semantic chunking -> Pinecone
|   |   |-- web-extract.py            # NEU catalog scraping -> Pinecone
|   |   `-- db_config.py
|   `-- data/raw/
|       |-- courses.csv
|       `-- prerequisites.csv
|
|-- src/
|   |-- data/
|   |   |-- adzuna_scraper.py         # Adzuna API -> raw skills extraction
|   |   `-- careers_builder.py        # Adzuna + Gemini -> careers.json
|   |
|   |-- models/
|   |   |-- postgres_filter.py        # student context + degree audit
|   |   |-- query_builder.py          # careers.json -> skill query
|   |   `-- retriever.py              # full RAG pipeline
|   |
|   |-- agents/
|   |   `-- recommendation_agent.py   # orchestrates pipeline + Gemini explanation
|   |
|   |-- tracking/
|   |   |-- __init__.py
|   |   `-- mlflow_tracker.py         # MLflow experiment tracking module
|   |
|   `-- evaluation/
|       |-- eval_runner.py            # evaluation metrics + MLflow hook
|       `-- llm_comparator.py         # multi-LLM response comparison
|
|-- scripts/
|   |-- run_eval_with_mlflow.py       # MLflow wrapper for RAG evaluation
|   |-- run_llm_comparison_mlflow.py  # MLflow wrapper for LLM comparison
|   |-- demo_mlflow_tracker.py        # demo script for all tracking functions
|   `-- test_mlflow_connection.py     # DagsHub connection test
|
|-- data/
|   |-- careers.json                  # Adzuna + Gemini career skill profiles
|   |-- eval_dataset.json             # 15 hand-crafted test cases
|   |-- schema.sql                    # Postgres table definitions
|   `-- Seed_data.pgsql               # seed data for all tables
|
|-- .env.example                      # required environment variables
`-- pyproject.toml
```

---

## Environment Variables

Create a `.env` file in the project root with the following:

```
# Postgres (VM instance on GCP)
DB_HOST=34.23.27.68
DB_PORT=5432
DB_NAME=courseweave
DB_USER=courseweave_user
DB_PASSWORD=your_password

# Pinecone
PINECONE_API_KEY=your_key
PINECONE_INDEX_NAME=courseweave-hybrid

# GCP / Vertex AI
GCP_PROJECT_ID=courseweave-ai
GCP_LOCATION=us-central1
GCS_BUCKET=courseweave-ai-data

# Adzuna (for careers.json refresh)
ADZUNA_APP_ID=your_app_id
ADZUNA_APP_KEY=your_app_key

# LLM Comparison (optional — Groq is free)
GROQ_API_KEY=your_key
OPENAI_API_KEY=your_key   # optional

# DagsHub / MLflow Experiment Tracking
DAGSHUB_USERNAME=SIDDHARTH107
DAGSHUB_TOKEN=your_dagshub_token
MLFLOW_TRACKING_URI=https://dagshub.com/SIDDHARTH107/courseweave-ai.mlflow
```

**GCP Authentication (local development):**
```bash
gcloud auth application-default login
gcloud config set project courseweave-ai
```

No `GOOGLE_APPLICATION_CREDENTIALS` file needed. The `google-genai` SDK uses Application Default Credentials locally and the GCP metadata server in production.

---

## Database Schema

Four tables in PostgreSQL on the GCP VM instance:

| Table | Description |
|---|---|
| `courses` | All NEU courses with program_code, course_type (Core/Elective), credits |
| `prerequisites` | Course prerequisite mappings |
| `students` | Student profiles with program_code, target_career, degree_path |
| `student_courses` | Completed courses per student with grades |
| `program_requirements` | Credit requirements per program and degree path |

The `program_requirements` table contains degree path logic for:
- MS_DAE: 20 core credits + 12 elective (coursework) / 8 elective + 4 project (project path) / 4 elective + 8 thesis (thesis path)
- MS_DS, MS_CS, MS_DA, MS_IS: corresponding requirements

---

## Pinecone Index

Index name: `courseweave-hybrid`
Metric: `dotproduct` (required for hybrid sparse+dense search)
Dimension: 384 (BGE-small-en-v1.5)
Vectors: 74 (NEU IE department courses from web catalog + PDF syllabi)

Two data sources populate the index:
- `web-extract.py`: scrapes NEU course catalog HTML, extracts course descriptions
- `pdf-extract.py`: processes PDF syllabi from GCS with semantic chunking

---

## careers.json

Located at `data/careers.json`. Generated by running:
```bash
python src/data/careers_builder.py
```

This scrapes 20 Adzuna job postings per career role, extracts skills via regex, then uses Gemini 2.5 Flash to structure and enrich the skill profile. The `llm_additions` field tracks exactly what Gemini added beyond the Adzuna data for full traceability.

Covers: `data_engineer`, `data_scientist`, `ml_engineer`, `data_analyst`

The file is versioned in GCS with DVC and uploaded to `gs://courseweave-ai-data/data/careers.json` on each run.

---

## RAG Pipeline (retriever.py)

The full pipeline in `src/models/retriever.py`:

**Step 1 — Query rewriting**
Gemini rewrites the skill query into academic language matching course catalog vocabulary. Falls back to original query on failure.

**Step 2 — HyDE (Hypothetical Document Embedding)**
Gemini generates a hypothetical course description for the query. This is embedded with BGE and used as the search vector. The hypothesis text is also passed to the cross-encoder for better relevance scoring. Falls back to direct embedding on failure.

**Step 3 — Metadata pre-filter**
Filters Pinecone search to the student's department to reduce noise.

**Step 4 — Native Pinecone hybrid search**
Single query with both dense (BGE HyDE vector) and sparse (BM25) vectors. Pinecone fuses them natively using dotproduct. Returns 20 candidates.

**Step 5 — Cross-encoder reranking**
`cross-encoder/ms-marco-MiniLM-L-6-v2` scores each candidate against the HyDE hypothesis text. Threshold set to -10.0 to retain all candidates (cross-encoder produces logit scores, not probabilities).

**Step 6 — Context assembly + MMR**
Deduplicates to one chunk per course. MMR selects diverse candidates penalizing overlap with both already-selected recommendations and the student's completed courses.

**Step 7 — Guardrails**
Hard filters: course must be in the student's `eligible_courses` list from Postgres AND must not be in `completed_courses`. Both checks run independently.

---

## Degree Audit Logic

`postgres_filter.py` includes `get_degree_audit()` which computes:

- Credits completed vs total required
- Core courses remaining
- Elective credits needed based on chosen path (coursework / project / thesis)
- `next_action`: one of `ask_path`, `take_core`, `take_elective`, `complete`

When `next_action == ask_path`, the recommendation agent asks the student to choose their degree path before recommending courses. The path is saved to the `students.degree_path` column and the audit is refreshed.

---

## MLflow Experiment Tracking

All experiment tracking is handled through a remote MLflow server hosted on DagsHub, eliminating the need to run a local MLflow server.

**Dashboard:** [https://dagshub.com/SIDDHARTH107/courseweave-ai.mlflow](https://dagshub.com/SIDDHARTH107/courseweave-ai.mlflow)

### Setup

Install the required packages:
```bash
pip install mlflow dagshub python-dotenv
```

Add the following to your `.env`:
```
DAGSHUB_USERNAME=SIDDHARTH107
DAGSHUB_TOKEN=<xyz>
MLFLOW_TRACKING_URI=https://dagshub.com/SIDDHARTH107/courseweave-ai.mlflow
```

Test the connection:
```bash
python scripts/test_mlflow_connection.py
```

### Experiments Tracked

| Experiment | Script | What it logs |
|---|---|---|
| `courseweave-rag-evaluation` | `scripts/run_eval_with_mlflow.py` | Precision@3, Recall@3, guardrail violations, prereq accuracy, pass rate across 15 test cases |
| `courseweave-llm-comparison` | `scripts/run_llm_comparison_mlflow.py` | Latency, response length, and full response text for Gemini, Llama, and GPT-4o mini |

### Tracking Module

`src/tracking/mlflow_tracker.py` provides reusable functions for logging experiments:

- `init_tracking()` — initializes DagsHub + MLflow connection
- `track_embedding_experiment()` — logs embedding model, chunk size, generation time
- `track_rag_query()` — logs LLM config, retrieval results, response time, relevance score
- `track_prompt_experiment()` — logs prompt template versions and performance
- `track_experiment()` — generic tracker for any experiment type

### Running Evaluations with MLflow

**RAG evaluation (15 test cases):**
```bash
python scripts/run_eval_with_mlflow.py
```

This runs the full retrieval pipeline against `data/eval_dataset.json` and logs all metrics to the DagsHub MLflow dashboard. Takes ~4 minutes due to Gemini rate limiting (15s sleep between test cases).

**LLM comparison (Gemini vs Llama vs GPT-4o):**
```bash
python scripts/run_llm_comparison_mlflow.py
```

Runs the same retrieval context through multiple LLMs and logs latency, response length, and full response text as artifacts.

### Baseline Results

Results from initial evaluation run (March 24, 2026):

| Metric | Value |
|---|---|
| avg_precision_at_3 | 0.4667 |
| avg_recall_at_3 | 0.4667 |
| pass_rate | 1.0 |
| guardrail_violations | 0 |
| prereq_flag_accuracy | 0.7778 |
| gemini_calls_total | 30 |
| gemini_fallback_count | 0 |

### Custom MLflow Integration

To log a new experiment type, use the tracking module:
```python
from src.tracking.mlflow_tracker import init_tracking, track_experiment

init_tracking()
track_experiment(
    experiment_name="courseweave-custom",
    run_name="my_run",
    params={"model": "bge-small-en-v1.5", "top_k": 5},
    metrics={"precision": 0.85, "latency_sec": 2.1}
)
```

---

## Evaluation

### eval_runner.py

Runs the retrieval pipeline against 15 hand-crafted test cases in `data/eval_dataset.json`. Each test case overrides the student's completed course state so hypothetical scenarios (nearly complete, fresh student, guardrail edge cases) can be tested without modifying the database.

Metrics computed per run:
- `avg_precision_at_3`: of top 3 recommended, how many are in the expected list
- `avg_recall_at_3`: of expected courses, how many appear in top 3
- `total_guardrail_violations`: completed courses appearing in results (must be 0)
- `prereq_flag_accuracy`: correctly flagging missing prerequisites
- `pass_rate`: percentage of test cases with zero guardrail violations
- `gemini_fallback_count`: how many Gemini calls degraded to fallback (rate limit indicator)

Rate limit handling: 15 second sleep between test cases keeps Gemini usage under 10 RPM on the Vertex AI default quota. Change `SLEEP_BETWEEN_TESTS` to 7 after quota increase to 60 RPM is approved.

**Baseline (simple dense retriever, no RAG):**
```
avg_precision_at_3:      0.42
avg_recall_at_3:         0.42
guardrail_violations:    0
prereq_flag_accuracy:    0.78
pass_rate:               1.0
```

**MLflow integration:**
```python
import mlflow
import json
from src.evaluation.eval_runner import run_evaluation

config = {
    "embedding_model": "bge-small-en-v1.5",
    "top_k": 3,
    "reranking": True,
    "mmr": True,
    "hyde": True,
    "hybrid_search": True,
}

with mlflow.start_run(run_name="courseweave_full_rag"):
    for k, v in config.items():
        mlflow.log_param(k, v)

    metrics = run_evaluation(pipeline_config=config)

    mlflow.log_metric("avg_precision_at_3",      metrics["avg_precision_at_3"])
    mlflow.log_metric("avg_recall_at_3",         metrics["avg_recall_at_3"])
    mlflow.log_metric("guardrail_violations",     metrics["total_guardrail_violations"])
    mlflow.log_metric("prereq_flag_accuracy",     metrics["prereq_flag_accuracy"])
    mlflow.log_metric("pass_rate",                metrics["pass_rate"])
    mlflow.log_metric("gemini_calls_total",       metrics["gemini_calls_total"])
    mlflow.log_metric("gemini_fallback_count",    metrics["gemini_fallback_count"])

    with open("data/eval_results.json", "w") as f:
        json.dump(metrics, f, indent=2)
    mlflow.log_artifact("data/eval_results.json")
    mlflow.log_artifact("data/eval_dataset.json")
```

### llm_comparator.py

Runs the same retrieval results through multiple LLMs and compares response quality. Retrieval runs once; the same courses are passed to each LLM independently.

Models:
- Gemini 2.5 Flash via Vertex AI (GCP credits, always available)
- Llama 3.3 70B via Groq (free tier — set `GROQ_API_KEY` in `.env`)
- GPT-4o mini via OpenAI (optional — set `OPENAI_API_KEY` in `.env`)

Missing keys are detected automatically and those models are skipped.

**MLflow integration:**
```python
import mlflow
from src.evaluation.llm_comparator import compare_llms_for_student

with mlflow.start_run(run_name="llm_comparison_student_1"):
    results = compare_llms_for_student(student_id=1)

    for llm_name, data in results["responses"].items():
        mlflow.log_metric(f"{llm_name}_latency_seconds", data["latency_seconds"])
        mlflow.log_metric(f"{llm_name}_response_length", data["response_length"])
        mlflow.log_param(f"{llm_name}_status",           data["status"])
        if data["response"]:
            mlflow.log_text(data["response"], f"{llm_name}_response.txt")

    mlflow.log_text(results["prompt"], "shared_prompt.txt")

    with open("data/llm_comparison.json", "w") as f:
        json.dump(results, f, indent=2)
    mlflow.log_artifact("data/llm_comparison.json")
```

---
## CI/CD Pipeline

The project uses a three-stage CI/CD workflow implemented with GitHub Actions to ensure code quality, reproducibility, and deployment readiness.

---

### Continuous Integration (CI)

The CI pipeline runs on every push to `main` and `dev`, and on pull requests to `main`. It performs:

1. Environment setup (Python 3.10)
2. Dependency installation
3. Ruff linting for code quality
4. Unit test execution
5. Secure credential injection
6. Import validation for all core modules

The CI workflow validates that the full system initializes correctly with external dependencies such as Pinecone, PostgreSQL, and GCP.

#### CI Workflow Steps

- **Linting** — ensures consistent formatting and catches syntax issues
- **Unit Tests** — validates core business logic
- **Secrets Injection** — loads Pinecone, PostgreSQL, and GCP credentials
- **Import Validation** — verifies end-to-end module initialization

This prevents broken code from merging into `main`.

---

### Continuous Deployment (CD)

The CD workflow triggers automatically after CI completes successfully. It performs:

- Dependency installation
- Lightweight evaluation step
- Artifact packaging

This stage prepares the system for deployment without running heavy RAG evaluations.

The separation between CI and CD allows:

- Fast validation
- Modular deployment logic
- Scalable evaluation stages later

---

### Docker Build Pipeline

A Docker build workflow runs on pushes to the `main` branch. It:

1. Builds the container image
2. Runs a basic container execution test

This ensures:

- Dockerfile correctness
- Dependency reproducibility
- Deployment readiness
- Environment consistency

The container test verifies that the application starts successfully inside Docker.

---

## Unit Testing

Unit tests are located in:

```
tests/unit/
```

The tests cover core system components while mocking external dependencies to keep execution fast and deterministic.

---

### Test Coverage

#### 1. Adzuna Scraper

Validates skill extraction logic from job descriptions.

```
test_adzuna_scraper.py
```

Ensures:
- NLP extraction accuracy
- Correct skill parsing

#### 2. PostgreSQL Prerequisite Filter

Validates prerequisite checking logic.

```
test_postgres_filter.py
```

Ensures:
- Correct prerequisite validation
- Eligibility determination

#### 3. Query Builder

Tests skill query construction using mocked career data.

```
test_query_builder.py
```

Uses `monkeypatch` to mock `careers.json` loading and ensures:
- Query generation correctness
- Deterministic behavior

#### 4. Recommendation Agent

Tests formatting and orchestration logic.

```
test_recommendation_agent.py
```

Heavy dependencies (Retriever, Gemini, Pinecone) are mocked using `MagicMock` to:
- Avoid API calls
- Speed up CI
- Isolate logic

---

### Mocking Strategy

External services mocked in tests:

- Pinecone
- Gemini
- Retriever pipeline
- Google SDK

This ensures:
- Deterministic tests
- No network dependency
- Fast CI execution
- Reproducible results

---

### Test Execution

Run locally:

```bash
pytest tests/unit -v
```

CI automatically executes the same tests.

---

## CI/CD Architecture

```
Push / PR
   |
   v
CI Pipeline
   ├── Ruff lint
   ├── Unit tests
   ├── Secret injection
   └── Import validation
           |
           v
CD Pipeline
           |
           v
Docker Build
```

This architecture follows standard MLOps best practices:

- Automated testing
- Reproducible builds
- Secure credential handling
- Containerized deployment readiness

---

## Running the Pipeline

**Generate / refresh careers.json:**
```bash
python src/data/careers_builder.py
```

**Test the full retrieval pipeline:**
```bash
python src/models/retriever.py
```

**Test the recommendation agent:**
```bash
python src/agents/recommendation_agent.py
```

**Run evaluation:**
```bash
python src/evaluation/eval_runner.py
```

**Run evaluation with MLflow tracking:**
```bash
python scripts/run_eval_with_mlflow.py
```

**Run LLM comparison:**
```bash
python src/evaluation/llm_comparator.py
```

**Run LLM comparison with MLflow tracking:**
```bash
python scripts/run_llm_comparison_mlflow.py
```

---

## Data Pipeline (Airflow)

The Airflow DAG in `Data-Pipeline/dags/pipeline_dag.py` runs weekly and executes 8 tasks in sequence:

1. `acquire_data` — downloads CSVs from GCS bucket
2. `preprocess_data` — cleans and normalizes course and prerequisite data
3. `validate_data` — schema validation, generates stats report
4. `detect_anomalies` — SQL-based checks for circular prerequisites and missing prereq violations
5. `bias_detection` — Fairlearn analysis across program coverage
6. `dvc_versioning` — versions data artifacts to GCS DVC remote
7. `load_data` — upserts to PostgreSQL with ON CONFLICT DO NOTHING
8. `pipeline_report` — generates summary, sends Slack alert

Slack alerts are sent on each task completion or failure via `SLACK_WEBHOOK_URL`.

---

## Known Limitations

**Pinecone sparse vectors:** The `courseweave-hybrid` index uses dotproduct metric and supports sparse vectors. BM25 sparse vectors are fitted at runtime from the corpus. If sparse vector upserts have not been performed, the pipeline falls back to dense-only search automatically.

**Gemini rate limits:** Vertex AI default quota is 10 requests per minute for Gemini 2.5 Flash. The eval runner sleeps 15 seconds between test cases to stay within this limit. Request a quota increase to 60 RPM at `https://console.cloud.google.com/iam-admin/quotas?project=courseweave-ai` to reduce eval run time from 4 minutes to under 2 minutes.

**Cross-encoder scores:** The `ms-marco-MiniLM-L-6-v2` cross-encoder produces logit scores, not probabilities. Scores are negative for most course-query pairs on this corpus. The threshold is set to -10.0 to retain all candidates and let MMR and guardrails do the final filtering. Relative ranking is correct even with negative absolute scores.
# CourseWeave AI - Frontend + API layer added Sat Apr 11 00:45:54 EDT 2026
