from src.models import query_builder


def mock_load_careers():
    return {
        "careers": {
            "data_engineer": {
                "core_skills": ["Python", "SQL"],
                "tools": ["Airflow"],
                "nice_to_have": ["Spark"],
            }
        }
    }


# ── build_query ───────────────────────────────────────────────────────────────

def test_build_query_returns_dict(monkeypatch):
    monkeypatch.setattr(query_builder, "load_careers", mock_load_careers)
    result = query_builder.build_query("Data Engineer")
    assert isinstance(result, dict)
    assert "skill_query" in result
    assert "career_skills" in result


def test_query_not_empty(monkeypatch):
    monkeypatch.setattr(query_builder, "load_careers", mock_load_careers)
    result = query_builder.build_query("Data Engineer")
    assert len(result["skill_query"]) > 0


# ── get_career_skills ─────────────────────────────────────────────────────────

def test_get_career_skills_direct_match(monkeypatch):
    monkeypatch.setattr(query_builder, "load_careers", mock_load_careers)
    result = query_builder.get_career_skills("Data Engineer")
    assert result["core_skills"] == ["Python", "SQL"]
    assert result["tools"] == ["Airflow"]


def test_get_career_skills_not_found_returns_empty(monkeypatch):
    monkeypatch.setattr(query_builder, "load_careers", mock_load_careers)
    result = query_builder.get_career_skills("Quantum Physicist")
    assert result == {}


def test_get_career_skills_fuzzy_match(monkeypatch):
    monkeypatch.setattr(query_builder, "load_careers", mock_load_careers)
    # "engineer" is a partial match for "data_engineer"
    result = query_builder.get_career_skills("engineer")
    assert result != {}


# ── build_skill_query ─────────────────────────────────────────────────────────

def test_build_skill_query_core_skills_weighted(monkeypatch):
    monkeypatch.setattr(query_builder, "load_careers", mock_load_careers)
    result = query_builder.build_skill_query("Data Engineer")
    # Core skills repeated twice for weighting
    assert result.count("Python") == 2
    assert result.count("SQL") == 2


def test_build_skill_query_includes_tools(monkeypatch):
    monkeypatch.setattr(query_builder, "load_careers", mock_load_careers)
    result = query_builder.build_skill_query("Data Engineer")
    assert "Airflow" in result


def test_build_skill_query_fallback_to_career_title(monkeypatch):
    monkeypatch.setattr(query_builder, "load_careers", mock_load_careers)
    result = query_builder.build_skill_query("Unknown Career")
    assert result == "Unknown Career"