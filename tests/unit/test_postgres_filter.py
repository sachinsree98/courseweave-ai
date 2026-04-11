from src.models.postgres_filter import check_prerequisites_satisfied, reorder_by_prerequisites


# ── check_prerequisites_satisfied ────────────────────────────────────────────

def test_prereq_check_satisfied():
    prereq_map = {"IE7615": ["IE6400"]}
    satisfied, missing = check_prerequisites_satisfied("IE7615", ["IE6400"], prereq_map)
    assert satisfied is True
    assert missing == []


def test_prereq_check_not_satisfied():
    prereq_map = {"IE7615": ["IE6400", "IE6700"]}
    satisfied, missing = check_prerequisites_satisfied("IE7615", ["IE6400"], prereq_map)
    assert satisfied is False
    assert "IE6700" in missing


def test_prereq_check_all_missing():
    prereq_map = {"IE7615": ["IE6400", "IE6700"]}
    satisfied, missing = check_prerequisites_satisfied("IE7615", [], prereq_map)
    assert satisfied is False
    assert set(missing) == {"IE6400", "IE6700"}


def test_prereq_check_no_prereqs_required():
    prereq_map = {}
    satisfied, missing = check_prerequisites_satisfied("IE6400", [], prereq_map)
    assert satisfied is True
    assert missing == []


# ── reorder_by_prerequisites ──────────────────────────────────────────────────

def test_reorder_satisfied_courses_come_first():
    # IE6400 has no prereqs; IE7615 requires IE6400 (not completed)
    prereq_map = {"IE7615": ["IE6400"]}
    result = reorder_by_prerequisites(["IE7615", "IE6400"], [], prereq_map)
    codes = [r["course_code"] for r in result]
    assert codes[0] == "IE6400"
    assert codes[1] == "IE7615"


def test_reorder_marks_missing_prereqs():
    prereq_map = {"IE7615": ["IE7275"]}
    result = reorder_by_prerequisites(["IE7615"], [], prereq_map)
    assert result[0]["prereqs_satisfied"] is False
    assert "IE7275" in result[0]["missing_prereqs"]


def test_reorder_returns_all_courses():
    prereq_map = {}
    result = reorder_by_prerequisites(["IE6400", "IE6700", "IE7275"], [], prereq_map)
    assert len(result) == 3


def test_reorder_empty_list_returns_empty():
    result = reorder_by_prerequisites([], [], {})
    assert result == []


def test_reorder_completed_prereq_marked_satisfied():
    prereq_map = {"IE7275": ["IE6400"]}
    result = reorder_by_prerequisites(["IE7275"], ["IE6400"], prereq_map)
    assert result[0]["prereqs_satisfied"] is True
    assert result[0]["missing_prereqs"] == []