from src.data.adzuna_scraper import extract_skills_from_text


def test_skill_extraction():
    text = "We need Python and SQL experience"
    skills = extract_skills_from_text(text)
    assert "Python" in skills
    assert "SQL" in skills


def test_skill_extraction_empty_text():
    skills = extract_skills_from_text("")
    assert skills == []


def test_skill_extraction_no_matches():
    skills = extract_skills_from_text("We need a friendly and motivated team player")
    assert skills == []


def test_skill_extraction_case_insensitive():
    skills = extract_skills_from_text("experience with python and sql required")
    assert "Python" in skills
    assert "SQL" in skills


def test_skill_extraction_returns_sorted_list():
    skills = extract_skills_from_text("Python SQL Airflow Docker")
    assert skills == sorted(skills)