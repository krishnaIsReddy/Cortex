import pytest

from src.api.routes.repos import RepoCreate

CANONICAL = "https://github.com/octocat/hello-world"


@pytest.mark.parametrize("url", [
    "https://github.com/octocat/Hello-World",
    "https://github.com/octocat/Hello-World.git",
    "https://github.com/octocat/Hello-World/",
    "https://github.com/OctoCat/hello-world",
    "  https://github.com/octocat/Hello-World  ",
])
def test_urls_canonicalize_to_one_form(url):
    assert RepoCreate(url=url).url == CANONICAL


@pytest.mark.parametrize("url", [
    "https://example.com/octocat/Hello-World",
    "https://github.com/octocat",
    "octocat/Hello-World",
    "",
])
def test_non_repo_urls_are_rejected(url):
    with pytest.raises(ValueError):
        RepoCreate(url=url)