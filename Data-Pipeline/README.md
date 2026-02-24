# CourseWeave AI — Data Pipeline 🎓

This directory contains the complete data pipeline for CourseWeave AI, built using Apache Airflow, DVC, and Google Cloud Platform.

---

## 📁 Folder Structure

```
Data-Pipeline/
├── dags/
│   └── pipeline_dag.py        # Master Airflow DAG — orchestrates all tasks
├── data/
│   ├── raw/                   # Raw scraped course data (CSV files)
│   ├── processed/             # Cleaned, validated data + reports
│   └── temp/                  # Temporary files between pipeline tasks
├── scripts/
│   ├── acquire_data.py        # Loads raw CSV data into DataFrames
│   ├── preprocess_data.py     # Cleans and normalizes data
│   ├── validate_data.py       # Schema validation + statistics generation
│   ├── detect_anomalies.py    # Detects data anomalies in PostgreSQL
│   ├── load_data.py           # Loads cleaned data into PostgreSQL
│   ├── db_config.py           # PostgreSQL connection configuration
│   ├── web-extract.py         # Scrapes NEU course catalog website
│   └── pdf-extract.py         # Extracts data from PDF course syllabi
├── tests/
│   ├── test_acquire_data.py   # Unit tests for data acquisition
│   ├── test_preprocess_data.py # Unit tests for preprocessing
│   └── test_validate_data.py  # Unit tests for validation
├── logs/                      # Pipeline execution logs
├── dvc.yaml                   # DVC pipeline stages definition
└── README.md                  # This file
```

---

## 🔄 Pipeline Flow

```
NEU Website + PDFs
      ↓
web-extract.py + pdf-extract.py (Data Acquisition)
      ↓
GCS Bucket (courseweave-ai-data)
      ↓
Task 1: acquire_data     → Downloads from GCS → local data/raw/
      ↓
Task 2: preprocess_data  → Cleans, normalizes, deduplicates
      ↓
Task 3: validate_data    → Schema checks + statistics report
      ↓
Task 4: detect_anomalies → SQL checks on PostgreSQL
      ↓
Task 5: bias_detection   → Program coverage + Fairlearn analysis
      ↓
Task 6: dvc_versioning   → Versions data to GCS remote
      ↓
Task 7: load_data        → Loads to Cloud SQL PostgreSQL
      ↓
Task 8: pipeline_report  → Final summary saved to GCS
```

---

## ⚙️ Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/sachinsree98/courseweave-ai.git
cd courseweave-ai/Data-Pipeline
```

### 2. Create Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install -r ../requirements.txt
```

### 4. Configure Environment Variables
```bash
cp ../.env.example ../.env
```

Edit `.env` with your credentials:
```
SLACK_WEBHOOK_URL=your-slack-webhook-url
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account.json
GCP_PROJECT_ID=courseweave-ai
GCS_BUCKET_NAME=courseweave-ai-data
DB_HOST=your-cloud-sql-host
DB_PORT=5432
DB_NAME=courseweave
DB_USER=your-db-username
DB_PASSWORD=your-db-password
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=courseweave-ai
```

### 5. Set Up DVC Remote
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
dvc remote add -d gcsremote gs://courseweave-ai-data
dvc pull
```

### 6. Initialize Airflow
```bash
export AIRFLOW_HOME=$(pwd)/../airflow-home
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
airflow db migrate
airflow standalone
```

### 7. Access Airflow UI
```
http://localhost:8080
```
- Username: `admin`
- Password: Check `airflow-home/simple_auth_manager_passwords.json.generated`

---

## 🚀 Running the Pipeline

### Option 1 — Airflow UI
1. Go to `http://localhost:8080`
2. Find `courseweave_data_pipeline`
3. Click **▶️ Trigger**
4. Monitor all 8 tasks

### Option 2 — Command Line
```bash
export AIRFLOW_HOME=$(pwd)/../airflow-home
airflow dags trigger courseweave_data_pipeline
```

### Option 3 — Run Scripts Individually
```bash
cd scripts/
python acquire_data.py
python preprocess_data.py
python validate_data.py
python detect_anomalies.py
python load_data.py
```

---

## 🧪 Running Tests

```bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_preprocess_data.py -v

# Run with coverage
pytest tests/ --cov=scripts -v
```

**Expected output:**
```
23 passed in 1.31s
```

---

## 📊 Data Versioning with DVC

### Check DVC Status
```bash
dvc status
```

### Pull Latest Data
```bash
dvc pull
```

### Push Data to GCS
```bash
dvc push
```

### Reproduce Pipeline
```bash
dvc repro
```

---

## 📈 Data Schema & Statistics

After each pipeline run, statistics are automatically generated and saved to:
- Local: `data/processed/stats_report.json`
- GCS: `gs://courseweave-ai-data/processed/stats_report.json`

**Sample statistics:**
```json
{
  "total_courses": 25,
  "by_program": {
    "MS_DAE": 12,
    "MS_DS": 4,
    "MS_CS": 5,
    "MS_DA": 2,
    "MS_IS": 2
  },
  "avg_credits": 4.0,
  "unique_programs": 5
}
```

---

## 🔍 Bias Detection

The pipeline performs data slicing using **Fairlearn** to detect bias across programs:

### What is checked:
1. **Program Coverage** — Are all programs equally represented?
   - Flags programs with < 10% of total courses
   - Flags programs with 0 courses
2. **Credit Distribution** — Are credits fairly distributed?
   - Flags if credit average differs by > 1 across programs
3. **Fairlearn MetricFrame** — Course coverage by program group

### Mitigation Steps:
- If LOW COVERAGE detected → Add more courses for underrepresented programs
- If CREDIT IMBALANCE detected → Review credit allocation across programs
- All bias flags sent to Slack `#pipeline-alerts` channel

### Bias Report Location:
- Local: `data/processed/bias_report.json`
- GCS: `gs://courseweave-ai-data/processed/bias_report.json`

---

## 🚨 Anomaly Detection

Two SQL-based checks run against PostgreSQL after each pipeline run:

1. **Missing Prerequisites** — Students who completed courses without meeting prerequisites
2. **Circular Prerequisites** — Course A requires B, B requires A (impossible loop)

Alerts sent to Slack if anomalies detected!

---

## 📡 Monitoring & Alerts

### Slack Alerts
All pipeline events send Slack notifications:
- ✅ Task success messages
- 🚨 Task failure alerts
- ⚠️ Bias detection flags
- 🎉 Pipeline completion summary

### Airflow Monitoring
- Task logs: `airflow-home/logs/`
- Gantt chart: Available in Airflow UI
- Task duration tracking

### GCS Error Logs
- Web scraping errors: `gs://courseweave-ai-data/error_logs/`
- PDF extraction errors: `gs://courseweave-ai-data/error_logs/`

---

## 🔧 Troubleshooting

### GCP Credentials Error
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
```

### DVC Push Failed
```bash
dvc remote modify gcsremote credentialpath /path/to/service-account.json
dvc push
```

### Airflow DAG Not Found
```bash
airflow config get-value core dags_folder
```

### Database Connection Failed
```bash
cat .env | grep DB
```

---

## 👥 Team

- Sachin Sreekumar
- Nagashree Bommenahalli Kumaraswamy
- Kavin Priyadarrsan Murugesan
- Siddharth Mohapatra
- Vigneshwaran Jayaraman
- Jogeashwini Srinivasan Ramesh

---

## 🎓 Course

IE 7374 — Machine Learning Operations
Northeastern University, Spring 2026
