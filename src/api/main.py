from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import psycopg2
import psycopg2.extras
import jwt
import bcrypt
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="CourseWeave AI API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

JWT_SECRET    = os.getenv("JWT_SECRET", "courseweave-secret-key-change-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY    = 24

security = HTTPBearer()

PROGRAMS = ["MS_DAE", "MS_DS", "MS_CS", "MS_DA", "MS_IS"]
CAREERS  = ["Data Engineer", "Data Scientist", "ML Engineer", "Data Analyst"]


def get_db():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "34.23.27.68"),
        port=int(os.getenv("DB_PORT", 5432)),
        dbname=os.getenv("DB_NAME", "courseweave"),
        user=os.getenv("DB_USER", "courseweave_user"),
        password=os.getenv("DB_PASSWORD", ""),
    )


def create_token(student_id: int, email: str) -> str:
    payload = {
        "sub": str(student_id),
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRY),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(
            credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM]
        )
        return {"student_id": int(payload["sub"]), "email": payload["email"]}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_degree_audit(cur, student_id: int, program_code: str) -> dict:
    prog_map = {
        "MS_DAE": 40, "MS_DS": 40,
        "MS_CS": 40, "MS_DA": 40, "MS_IS": 40
    }
    total = prog_map.get(program_code, 40)

    cur.execute(
        """SELECT c.credits, c.course_type
           FROM student_courses sc
           JOIN courses c ON c.course_code = sc.course_code
           WHERE sc.student_id = %s""",
        (student_id,)
    )
    rows = cur.fetchall()
    credits_done = sum(r[0] for r in rows)
    core_done    = sum(1 for r in rows if r[1] == "Core")

    if credits_done >= total:
        next_action = "complete"
    elif core_done < 5:
        next_action = "take_core"
    else:
        next_action = "take_elective"

    return {
        "credits_completed": credits_done,
        "credits_remaining": max(total - credits_done, 0),
        "total_required":    total,
        "progress_pct":      round((credits_done / total) * 100),
        "next_action":       next_action,
    }


# ── Pydantic models ──────────────────────────────────────────────────────────

class CompletedCourse(BaseModel):
    course_code:  str
    completed_at: str
    grade:        Optional[str] = None

class SignupRequest(BaseModel):
    name:               str
    email:              EmailStr
    password:           str
    program_code:       str
    target_career:      str
    completed_courses:  List[CompletedCourse] = []

class LoginRequest(BaseModel):
    email:    EmailStr
    password: str

class RecommendRequest(BaseModel):
    career_goal: Optional[str] = None

class ChatRequest(BaseModel):
    message: str


# ── Auth ─────────────────────────────────────────────────────────────────────

@app.post("/auth/signup")
def signup(req: SignupRequest):
    if req.program_code not in PROGRAMS:
        raise HTTPException(400, detail=f"Invalid program. Choose from {PROGRAMS}")
    if req.target_career not in CAREERS:
        raise HTTPException(400, detail=f"Invalid career. Choose from {CAREERS}")

    hashed = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()

    try:
        conn = get_db()
        conn.autocommit = False
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute(
            """INSERT INTO students (name, email, program_code, target_career, password_hash)
               VALUES (%s,%s,%s,%s,%s) RETURNING id, name, email, program_code, target_career""",
            (req.name, req.email, req.program_code, req.target_career, hashed),
        )
        student = dict(cur.fetchone())
        sid     = student["id"]

        for c in req.completed_courses:
            try:
                cur.execute(
                    """INSERT INTO student_courses (student_id, course_code, completed_at, grade)
                       VALUES (%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
                    (sid, c.course_code, c.completed_at, c.grade),
                )
            except Exception:
                pass

        conn.commit()

        audit = get_degree_audit(cur, sid, req.program_code)

        recommendation = _get_recommendation_text(sid, req.target_career, cur)

        conn.close()

        token = create_token(sid, req.email)
        return {
            "token":      token,
            "student_id": sid,
            "name":       student["name"],
            "program_code":   student["program_code"],
            "target_career":  student["target_career"],
            "degree_audit":   audit,
            "recommendation": recommendation,
        }

    except psycopg2.errors.UniqueViolation:
        raise HTTPException(409, detail="Email already registered")
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.post("/auth/login")
def login(req: LoginRequest):
    try:
        conn = get_db()
        conn.autocommit = True
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute("SELECT * FROM students WHERE email = %s", (req.email,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(401, detail="Invalid credentials")

        student = dict(row)
        pw_hash = student.get("password_hash", "")
        if not pw_hash or not bcrypt.checkpw(req.password.encode(), pw_hash.encode()):
            raise HTTPException(401, detail="Invalid credentials")

        sid   = student["id"]
        token = create_token(sid, student["email"])

        audit = get_degree_audit(cur, sid, student["program_code"])
        conn.close()

        student.pop("password_hash", None)
        return {
            "token":         token,
            "student_id":    sid,
            "name":          student["name"],
            "email":         student["email"],
            "program_code":  student["program_code"],
            "target_career": student["target_career"],
            "degree_audit":  audit,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.get("/auth/me")
def me(user=Depends(verify_token)):
    try:
        conn = get_db()
        conn.autocommit = True
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT id, name, email, program_code, target_career FROM students WHERE id = %s",
            (user["student_id"],),
        )
        student = dict(cur.fetchone())
        audit   = get_degree_audit(cur, user["student_id"], student["program_code"])
        conn.close()
        student["degree_audit"] = audit
        return student
    except Exception as e:
        raise HTTPException(500, detail=str(e))


# ── Courses ───────────────────────────────────────────────────────────────────

@app.get("/courses")
def get_courses(
    program: Optional[str] = None,
    course_type: Optional[str] = None,
    user=Depends(verify_token)
):
    try:
        conn = get_db()
        conn.autocommit = True
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        q    = "SELECT * FROM courses WHERE is_active = TRUE"
        p    = []
        if program:
            q += " AND program_code = %s"
        p.append(program)
        if course_type:
            q += " AND course_type = %s"
        p.append(course_type)
        q += " ORDER BY program_code, course_type, course_code"
        cur.execute(q, p)
        courses = [dict(r) for r in cur.fetchall()]
        conn.close()
        return courses
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.get("/courses/all-programs")
def get_all_courses_for_signup(user=Depends(verify_token)):
    """Returns all courses for signup multi-select — no program filter."""
    try:
        conn = get_db()
        conn.autocommit = True
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """SELECT course_code, course_name, credits, program_code, course_type
               FROM courses WHERE is_active = TRUE
               ORDER BY program_code, course_code"""
        )
        courses = [dict(r) for r in cur.fetchall()]
        conn.close()
        return courses
    except Exception as e:
        raise HTTPException(500, detail=str(e))


# ── Student ───────────────────────────────────────────────────────────────────

@app.get("/student/dashboard")
def dashboard(user=Depends(verify_token)):
    sid = user["student_id"]
    try:
        conn = get_db()
        conn.autocommit = True
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute(
            "SELECT id, name, email, program_code, target_career FROM students WHERE id = %s",
            (sid,)
        )
        student = dict(cur.fetchone())

        cur.execute(
            """SELECT sc.course_code, c.course_name, c.credits, c.course_type,
                      sc.grade, sc.completed_at
               FROM student_courses sc
               JOIN courses c ON c.course_code = sc.course_code
               WHERE sc.student_id = %s ORDER BY sc.completed_at DESC""",
            (sid,)
        )
        completed = [dict(r) for r in cur.fetchall()]

        cur.execute(
            """SELECT c.course_code, c.course_name, c.credits, c.course_type
               FROM courses c
               WHERE c.program_code = %s AND c.is_active = TRUE
               AND c.course_code NOT IN (
                   SELECT course_code FROM student_courses WHERE student_id = %s
               ) ORDER BY c.course_type, c.course_code""",
            (student["program_code"], sid)
        )
        remaining = [dict(r) for r in cur.fetchall()]

        audit = get_degree_audit(cur, sid, student["program_code"])

        gpa_map = {"A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7, "C+": 2.3, "C": 2.0}
        grades  = [gpa_map.get(c["grade"], 0) for c in completed if c["grade"]]
        gpa     = round(sum(grades) / len(grades), 2) if grades else 0.0

        conn.close()
        return {
            "student":           student,
            "degree_audit":      audit,
            "gpa":               gpa,
            "completed_courses": completed,
            "remaining_courses": remaining,
        }
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.get("/student/courses")
def student_courses(user=Depends(verify_token)):
    sid = user["student_id"]
    try:
        conn = get_db()
        conn.autocommit = True
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """SELECT sc.id, sc.course_code, c.course_name, c.credits,
                      c.course_type, sc.grade, sc.completed_at
               FROM student_courses sc
               JOIN courses c ON c.course_code = sc.course_code
               WHERE sc.student_id = %s ORDER BY sc.completed_at DESC""",
            (sid,)
        )
        courses = [dict(r) for r in cur.fetchall()]
        conn.close()
        return courses
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.get("/student/prerequisites")
def prerequisites(user=Depends(verify_token)):
    sid = user["student_id"]
    try:
        conn = get_db()
        conn.autocommit = True
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute(
            "SELECT course_code FROM student_courses WHERE student_id = %s", (sid,)
        )
        completed_codes = {r["course_code"] for r in cur.fetchall()}

        cur.execute(
            """SELECT course_code, course_name FROM courses
               WHERE program_code = (SELECT program_code FROM students WHERE id = %s)
               AND is_active = TRUE""",
            (sid,)
        )
        all_courses = [dict(r) for r in cur.fetchall()]

        result = []
        for course in all_courses:
            code = course["course_code"]
            cur.execute(
                """SELECT p.required_course_code, c.course_name
                   FROM prerequisites p
                   JOIN courses c ON c.course_code = p.required_course_code
                   WHERE p.course_code = %s""",
                (code,)
            )
            prereqs = [dict(r) for r in cur.fetchall()]
            if not prereqs:
                continue
            missing = [p for p in prereqs if p["required_course_code"] not in completed_codes]
            result.append({
                "course_code":            code,
                "course_name":            course["course_name"],
                "prerequisites":          prereqs,
                "missing_prerequisites":  missing,
                "eligible":               len(missing) == 0,
                "completed":              code in completed_codes,
            })

        conn.close()
        return result
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.get("/student/roadmap")
def roadmap(user=Depends(verify_token)):
    sid = user["student_id"]
    try:
        conn = get_db()
        conn.autocommit = True
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute(
            """SELECT sc.course_code, c.course_name, c.credits, c.course_type,
                      sc.grade, sc.completed_at
               FROM student_courses sc JOIN courses c ON c.course_code = sc.course_code
               WHERE sc.student_id = %s ORDER BY sc.completed_at""",
            (sid,)
        )
        completed = [dict(r) for r in cur.fetchall()]

        cur.execute(
            """SELECT c.course_code, c.course_name, c.credits, c.course_type
               FROM courses c
               WHERE c.program_code = (SELECT program_code FROM students WHERE id = %s)
               AND c.is_active = TRUE
               AND c.course_code NOT IN (
                   SELECT course_code FROM student_courses WHERE student_id = %s
               ) ORDER BY c.course_type, c.course_code""",
            (sid, sid)
        )
        remaining = [dict(r) for r in cur.fetchall()]
        conn.close()

        semesters = []
        dates = {}
        for c in completed:
            key = str(c["completed_at"])[:7]
            if key not in dates:
                dates[key] = []
            dates[key].append(c)
        for i, (date, courses) in enumerate(sorted(dates.items()), 1):
            semesters.append({"label": f"Semester {i}", "status": "completed", "courses": courses})

        chunk = 3
        for i in range(0, len(remaining), chunk):
            sem_num = len(semesters) + 1
            status  = "current" if i == 0 else "planned"
            semesters.append({
                "label":   f"Semester {sem_num}",
                "status":  status,
                "courses": remaining[i:i + chunk],
            })

        return {"semesters": semesters}
    except Exception as e:
        raise HTTPException(500, detail=str(e))


# ── Recommendations ───────────────────────────────────────────────────────────

def _get_recommendation_text(student_id: int, target_career: str, cur) -> str:
    try:
        import sys
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))
        from src.agents.recommendation_agent import RecommendationAgent
        agent  = RecommendationAgent()
        result = agent.recommend(student_id=student_id)
        return result
    except Exception:
        cur.execute(
            """SELECT c.course_code, c.course_name, c.credits, c.course_type
               FROM courses c
               WHERE c.program_code = (SELECT program_code FROM students WHERE id = %s)
               AND c.is_active = TRUE
               AND c.course_code NOT IN (
                   SELECT course_code FROM student_courses WHERE student_id = %s
               ) LIMIT 3""",
            (student_id, student_id)
        )
        courses = cur.fetchall()
        if not courses:
            return f"Complete your core courses to unlock personalized recommendations for {target_career}."
        names = ", ".join(c[1] for c in courses)
        return f"Based on your goal of becoming a {target_career}, we recommend: {names}."


@app.post("/recommend")
def recommend(req: RecommendRequest, user=Depends(verify_token)):
    sid = user["student_id"]
    try:
        conn = get_db()
        conn.autocommit = True
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute(
            "SELECT target_career, program_code FROM students WHERE id = %s", (sid,)
        )
        student = dict(cur.fetchone())
        career  = req.career_goal or student["target_career"]

        cur.execute(
            """SELECT c.course_code, c.course_name, c.credits, c.course_type
               FROM courses c
               WHERE c.program_code = %s AND c.is_active = TRUE
               AND c.course_code NOT IN (
                   SELECT course_code FROM student_courses WHERE student_id = %s
               ) ORDER BY c.course_type, c.course_code LIMIT 5""",
            (student["program_code"], sid)
        )
        courses = [dict(r) for r in cur.fetchall()]

        try:
            import sys
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))
            from src.agents.recommendation_agent import RecommendationAgent
            agent  = RecommendationAgent()
            result = agent.recommend(student_id=sid)
            conn.close()
            return {"recommendations": courses, "explanation": result, "source": "rag"}
        except Exception:
            conn.close()
            return {
                "recommendations": courses,
                "explanation": f"Based on your goal of becoming a {career}, here are your next recommended courses.",
                "source": "catalog",
            }
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.post("/chat")
def chat(req: ChatRequest, user=Depends(verify_token)):
    sid = user["student_id"]
    try:
        conn = get_db()
        conn.autocommit = True
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT name, program_code, target_career FROM students WHERE id = %s", (sid,)
        )
        student = dict(cur.fetchone())
        audit   = get_degree_audit(cur, sid, student["program_code"])
        conn.close()

        try:
            import sys
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))
            from src.agents.recommendation_agent import RecommendationAgent
            agent  = RecommendationAgent()
            reply  = agent.chat(message=req.message, student_id=sid)
            return {"reply": reply, "source": "rag"}
        except Exception:
            reply = _simple_chat_reply(req.message, student, audit)
            return {"reply": reply, "source": "fallback"}
    except Exception as e:
        raise HTTPException(500, detail=str(e))


def _simple_chat_reply(message: str, student: dict, audit: dict) -> str:
    msg = message.lower()
    if any(w in msg for w in ["recommend", "suggest", "take", "course"]):
        return f"Based on your {student['target_career']} goal and {audit['credits_remaining']} credits remaining, focus on your core requirements first. Visit the Recommendations page for personalized suggestions."
    if any(w in msg for w in ["prerequisite", "prereq", "eligible"]):
        return "Check the Prerequisites page to see exactly which courses you're eligible for based on your completed courses."
    if any(w in msg for w in ["graduate", "graduation", "finish", "complete"]):
        return f"You have {audit['credits_completed']} of {audit['total_required']} credits completed ({audit['progress_pct']}%). At 3 courses per semester you're on track!"
    if any(w in msg for w in ["gpa", "grade"]):
        return "Your grades are tracked on the Progress page. Keep aiming for A's in core courses — they matter most for your career goals."
    return f"Great question! As a {student['program_code']} student targeting {student['target_career']}, I recommend checking your roadmap and prerequisites pages for the most up-to-date guidance."


@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0"}
