#!/usr/bin/env python3
"""Search GitHub (unauthenticated REST API) for Claude skill candidates.

Usage:
    search_github.py code <query>     # search code for SKILL.md files matching query
    search_github.py repos <query>    # search repositories matching query
"""
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.github.com"
HEADERS = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "github-skill-scout",
}


def _get(url):
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        print(f"HTTP {e.code} for {url}\n{body}", file=sys.stderr)
        if e.code in (403, 429):
            print("Rate-limited by GitHub's unauthenticated API. Wait before retrying.", file=sys.stderr)
        sys.exit(1)


def search_code(query):
    q = urllib.parse.quote(f"{query} filename:SKILL.md")
    data = _get(f"{API}/search/code?q={q}&per_page=30")
    results = []
    for item in data.get("items", []):
        repo = item["repository"]["full_name"]
        path = item["path"]
        results.append({
            "repo": repo,
            "path": path,
            "raw_url": f"https://raw.githubusercontent.com/{repo}/HEAD/{path}",
            "html_url": item.get("html_url"),
        })
    print(json.dumps({"total_count": data.get("total_count", 0), "results": results}, indent=2))


def search_repos(query):
    q = urllib.parse.quote(f"{query} claude skill in:name,description,topics")
    data = _get(f"{API}/search/repositories?q={q}&per_page=30&sort=stars&order=desc")
    results = []
    for item in data.get("items", []):
        results.append({
            "repo": item["full_name"],
            "description": item.get("description"),
            "stars": item.get("stargazers_count"),
            "html_url": item.get("html_url"),
            "default_branch": item.get("default_branch"),
        })
    print(json.dumps({"total_count": data.get("total_count", 0), "results": results}, indent=2))


def main():
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        sys.exit(1)
    mode, query = sys.argv[1], " ".join(sys.argv[2:])
    if mode == "code":
        search_code(query)
    elif mode == "repos":
        search_repos(query)
    else:
        print(f"Unknown mode: {mode!r} (expected 'code' or 'repos')", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
