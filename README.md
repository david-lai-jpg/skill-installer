# skill-installer

A CLI tool to manage a personal catalog of [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skill installation commands. Build your collection once, install anywhere.

## Why

Claude Code skills are installed via `npx`/`pnpx` commands scattered across different repos and docs. You end up hunting through bookmarks, READMEs, and chat histories every time you start a new project. This tool gives you a single catalog you can carry across machines (via git) and run against any project.

## Install

```bash
# Clone and install globally
git clone https://github.com/david-lai-jpg/skill-installer.git
cd skill-installer
npm install -g .
```

Requires **Node.js >= 18**.

## Quick Start

```bash
# Initialize (first time only)
skill-installer init

# Add a skill to your catalog
skill-installer add

# Browse and install skills into your current project
skill-installer install
```

## Commands

### `skill-installer init`

First-time setup. Creates `catalog.json` if missing, verifies git remote for syncing, checks Node.js version.

### `skill-installer add`

Interactive prompts to add a new skill:

| Field       | Required | Notes                                      |
|-------------|----------|---------------------------------------------|
| name        | yes      | Must be unique                              |
| command     | yes      | The `npx`/`pnpx` install command            |
| category    | no       | Freeform string for grouping                |
| tags        | no       | Comma-separated, used for filtering         |
| description | no       | What the skill does                         |

If the command matches an existing entry, you'll get a duplicate warning.

### `skill-installer update`

Select a skill from the catalog, then choose which field to edit.

### `skill-installer delete`

Multi-select skills to remove with confirmation.

### `skill-installer list`

Display all cataloged skills. Filter with flags:

```bash
skill-installer list                    # all skills
skill-installer list --category react   # by category
skill-installer list --tag performance  # by tag
```

### `skill-installer install`

The main event. Interactive flow:

1. **Optional filter** — narrow by category or tag
2. **Checkbox selection** — pick skills from a grouped list
3. **Confirm** — review commands before running
4. **Execute** — runs each command sequentially with `stdio: inherit` (supports interactive installers)
5. **Summary** — final report of what succeeded/failed

On failure, you choose to continue or abort. Skipped skills are tracked in the summary.

### `skill-installer import <file>`

Merge skills from a JSON file into your catalog. Handles name collisions per-entry (skip, overwrite, or rename).

```bash
skill-installer import ~/shared-skills.json
```

### `skill-installer export <file>`

Dump your catalog to a JSON file for sharing or backup.

```bash
skill-installer export ~/my-skills.json
```

## Catalog Format

The catalog is a JSON array stored in `catalog.json` at the repo root:

```json
[
  {
    "id": "a1b2c3d4-...",
    "name": "vercel-react-best-practices",
    "command": "npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices",
    "category": "react",
    "tags": ["performance", "next.js"],
    "description": "Vercel's React/Next.js optimization guidelines"
  }
]
```

## Git Sync

Every catalog mutation (add, update, delete, import) triggers automatic git sync:

1. Pull latest from remote (if configured)
2. Stage `catalog.json`
3. Commit with `"update skill catalog"`
4. Push to remote

This keeps your catalog synced across machines. If push fails, the local commit is preserved — push manually when ready.

## Project Structure

```
skill-installer/
├── bin/cli.js          # Entry point, arg routing
├── src/
│   ├── catalog.js      # CRUD operations
│   ├── installer.js    # Select & run flow
│   ├── git.js          # Git sync
│   └── utils.js        # Paths, colors, helpers
├── catalog.json        # Your skill catalog (committed)
└── package.json
```

## Dependencies

| Package            | Purpose                  |
|--------------------|--------------------------|
| `@inquirer/prompts` | Interactive CLI prompts  |
| `mri`              | Minimal argument parsing |
| `picocolors`       | Terminal colors           |

## License

MIT
