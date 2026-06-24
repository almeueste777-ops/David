#!/usr/bin/env python3
"""Install a skill directory from a GitHub repo into .claude/skills/<name>/.

Usage:
    install_skill.py <owner/repo> <path/to/skill-dir> [--name <target-name>] [--ref <branch>]

Recursively downloads every file under <path/to/skill-dir> in the repo's tree, preserving
subdirectory structure (scripts/, references/, assets/, etc.), into
.claude/skills/<target-name>/. Defaults --name to the last path segment, and --ref to the repo's
default branch.
"""
import json
import os
import stat
import subprocess
import sys
import urllib.error
import urllib.request

API = "https://api.github.com"
HEADERS = {"Accept": "application/vnd.github+json", "User-Agent": "github-skill-scout"}
EXEC_SUFFIXES = (".py", ".sh", ".mjs", ".js")


def _get(url):
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code} for {url}\n{e.read().decode('utf-8', 'replace')}", file=sys.stderr)
        sys.exit(1)


def default_branch(repo):
    return _get(f"{API}/repos/{repo}")["default_branch"]


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        print(__doc__, file=sys.stderr)
        sys.exit(1)
    repo, skill_path = args[0], args[1].strip("/")
    name = None
    ref = None
    i = 2
    while i < len(args):
        if args[i] == "--name":
            name = args[i + 1]
            i += 2
        elif args[i] == "--ref":
            ref = args[i + 1]
            i += 2
        else:
            i += 1

    if name is None:
        name = skill_path.rstrip("/").split("/")[-1]
    if ref is None:
        ref = default_branch(repo)

    tree = _get(f"{API}/repos/{repo}/git/trees/{ref}?recursive=1")
    if tree.get("truncated"):
        print("Warning: tree response truncated by GitHub API; some files may be missing.", file=sys.stderr)

    prefix = skill_path + "/"
    dest_root = os.path.join(".claude", "skills", name)
    count = 0
    for item in tree.get("tree", []):
        path = item["path"]
        if not path.startswith(prefix):
            continue
        rel = path[len(prefix):]
        target = os.path.join(dest_root, rel)
        if item["type"] == "tree":
            os.makedirs(target, exist_ok=True)
        elif item["type"] == "blob":
            os.makedirs(os.path.dirname(target), exist_ok=True)
            url = f"https://raw.githubusercontent.com/{repo}/{ref}/{path}"
            subprocess.run(["curl", "-sS", "-o", target, url], check=True)
            if target.endswith(EXEC_SUFFIXES):
                st = os.stat(target)
                os.chmod(target, st.st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
            count += 1

    if count == 0:
        print(f"No files found under '{skill_path}' in {repo}@{ref}. Check the path.", file=sys.stderr)
        sys.exit(1)

    print(f"Installed {count} files into {dest_root}/")


if __name__ == "__main__":
    main()
