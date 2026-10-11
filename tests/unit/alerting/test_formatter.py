import uuid

from src.services.alerting.slack_formatter import MAX_FILES_SHOWN, format_digest, repo_display_name
from src.services.scoring.models import FileRisk

REPO_ID = uuid.uuid4()

def risk(path, score=0.9, owner="alice"):
    return FileRisk(REPO_ID, path, score, owner, score)

def file_sections(message):
    return [b for b in message["blocks"] if b["type"] == "section" and "`" in b["text"]["text"]]

def test_message_has_fallback_text_and_header():
    message = format_digest("org/repo", [risk("a.py"), risk("b.py")])

    assert message["text"] == "Cortex: 2 files in org/repo became high-risk"
    assert message["blocks"][0]["text"]["text"] == "2 files became high-risk"

def test_single_file_is_singular():
    message = format_digest("org/repo", [risk("a.py")])

    assert message["blocks"][0]["text"]["text"] == "1 file became high-risk"

def test_file_line_shows_path_score_and_owner():
    message = format_digest("org/repo", [risk("src/a.py", 0.92, "bob")])

    text = file_sections(message)[0]["text"]["text"]
    assert "`src/a.py`" in text
    assert "Risk 92%" in text
    assert "*bob* owns 92% of lines" in text

def test_long_digest_is_truncated():
    files = [risk(f"f{i}.py") for i in range(MAX_FILES_SHOWN + 3)]

    message = format_digest("org/repo", files)

    assert len(file_sections(message)) == MAX_FILES_SHOWN
    assert message["blocks"][-1]["elements"][0]["text"] == "…and 3 more"

def test_slack_control_characters_are_escaped():
    message = format_digest("org/repo", [risk("a<b>&c.py", owner="<!channel>")])

    text = file_sections(message)[0]["text"]["text"]
    assert "a&lt;b&gt;&amp;c.py" in text
    assert "&lt;!channel&gt;" in text

def test_repo_display_name():
    assert repo_display_name("https://github.com/krishnaIsReddy/Cortex") == "krishnaIsReddy/Cortex"
    assert repo_display_name("https://github.com/krishnaIsReddy/Cortex.git") == "krishnaIsReddy/Cortex"
    assert repo_display_name("https://github.com/krishnaIsReddy/Cortex/") == "krishnaIsReddy/Cortex"
