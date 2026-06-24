# Known Claude Skill Sources

Curated marketplaces/repos already vetted for this project. Check these before doing a cold
GitHub search — they cover most general-purpose needs.

| Repo | Layout | Notes |
|---|---|---|
| `anthropics/skills` | `skills/<name>/` at repo root | Official Anthropic skills: docx, pptx, xlsx, pdf, skill-creator, mcp-builder, webapp-testing, brand-guidelines, frontend-design, canvas-design, doc-coauthoring, internal-comms, theme-factory, algorithmic-art, slack-gif-creator, claude-api, web-artifacts-builder. Highest trust, no marketplace.json — just browse `skills/`. |
| `ComposioHQ/awesome-claude-skills` | `<skill-name>/SKILL.md` at repo root | Curated list of community skills, one dir per skill (e.g. `skill-creator/`). |
| `alirezarezvani/claude-skills` | `.claude-plugin/marketplace.json` lists 78 plugins; each plugin's real skill(s) live at `<plugin-source>/skills/<skill-name>/` | Huge marketplace: engineering (37 advanced skills under `engineering/skills/`), research domain (`research/<plugin>/skills/<plugin>/`), c-level, marketing, product, finance, compliance, etc. Always read the plugin's `.claude-plugin/plugin.json` `"skills"` field to find the real skill subpath — the top-level plugin dir often also contains sibling plugins as subdirectories. |
| `multica-ai/andrej-karpathy-skills` | `skills/<name>/SKILL.md` | Small, single-purpose behavioral-guideline skills (e.g. karpathy-guidelines). Also ships an equivalent `CLAUDE.md` at repo root for project-wide (always-on) use instead of skill-triggered use. |

## How to read a marketplace.json

```bash
curl -sS https://raw.githubusercontent.com/<owner>/<repo>/<branch>/.claude-plugin/marketplace.json
```

Each entry has `name`, `description`, `source` (relative path to the plugin dir). The plugin dir's
own `.claude-plugin/plugin.json` has a `"skills"` array of relative paths — that's where the actual
`SKILL.md` lives, not necessarily at the plugin dir root (the plugin dir can contain sibling plugins
as subdirectories too — see alirezarezvani/claude-skills/engineering).

## Adding a new source

Append a row here once a new marketplace/repo has been explored and confirmed useful, so future
searches start from this table instead of a cold GitHub search.
