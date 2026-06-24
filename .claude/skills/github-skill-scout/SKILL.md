---
name: github-skill-scout
description: Searches GitHub for Claude Code skills and plugins (SKILL.md packages, skill marketplaces), produces a deep-research style report of candidates with descriptions, and installs a chosen skill into .claude/skills/ on request. Use when the user wants to find, browse, discover, or install Claude/Claude Code skills from GitHub, or asks "is there a skill for X", "find a skill that does X", "search GitHub for skills", or names a known skill marketplace repo.
license: MIT
---

# GitHub Skill Scout

Discovers installable Claude Code skills on GitHub and installs the ones the user picks.

## Workflow

### 1. Deep research (enumerate candidates)

Run in this order, stopping early only if the user just wants "the skill for X" and an exact match
is already found in step (a):

**(a) Known sources first.** Check `references/known_sources.md` for marketplaces and repos already
vetted in this project. Many of these are multi-skill marketplaces (one repo = dozens of skills) —
fetch their `marketplace.json` or repo tree and filter entries by the user's topic before going further.

**(b) Live GitHub code search.** Use `scripts/search_github.py code <query>` to search for
`SKILL.md` files matching the query across all of GitHub. This is the fastest way to find skills
outside the known sources.

**(c) Live GitHub repo search.** Use `scripts/search_github.py repos <query>` to find repos whose
name/description/topics mention "claude skill", "claude-code-skill", etc. Useful when (b) returns
nothing because the repo doesn't use a literal `SKILL.md` filename match in search snippets.

**(d) Read each candidate's actual SKILL.md** (raw.githubusercontent.com) before listing it — do
not present a repo as a match based on its README alone. Extract the `name` and `description`
frontmatter fields; that description tells you exactly when the skill triggers.

GitHub's search API is unauthenticated and rate-limited (~10 req/min for code search). Batch
queries thoughtfully; don't loop tightly. If a 403/rate-limit response comes back, stop and tell
the user rather than retrying in a hot loop.

### 2. Present findings

List each candidate skill as:

```
- **<skill-name>** (<owner/repo> @ <path>) — <one-line of what it does, from its own description>
```

Group by source/marketplace if there are many. Flag anything that bundles scripts requiring
external API keys, network calls, or unusual permissions — the user should know before installing.

### 3. Install on request

Never install automatically — only after the user picks specific skill(s) from the list.

Run:

```bash
scripts/install_skill.py <owner/repo> <path/to/skill-dir> [--name <target-name>] [--ref <branch>]
```

This recursively downloads everything under `<path/to/skill-dir>` in the repo (preserving
subdirectory structure: scripts/, references/, assets/, etc.) into
`.claude/skills/<target-name>/`, and chmods any `.py`/`.sh`/`.mjs` scripts executable.

After installing, verify by checking the file count/size match what the script reports, and that
`SKILL.md` frontmatter `name` matches the target directory name (rename the frontmatter `name` field
if it doesn't, so the skill registers correctly).

If the user wants it committed, `git add` the new directory, commit, and push to the current
branch — but only when asked, same as any other git operation.

### 4. Update known sources

If a newly discovered marketplace/repo looks reusable for future searches (multi-skill, well
maintained), add it to `references/known_sources.md` so future research starts there instead of
a cold GitHub search.
