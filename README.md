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

Run `skill-installer` without arguments for an action menu. `--help` prints usage; non-interactive launches without arguments also print usage.

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

Required fields and duplicate names show an error in place so you can correct the value. If the command matches an existing entry, you'll get a duplicate warning.

### `skill-installer update`

Select a skill, edit as many fields as needed, then choose **Save**. **Cancel** or Ctrl+C discards the draft. Changes are saved and synced once.

### `skill-installer delete`

Search and select in one list. Each skill shows `name ● install command ● description` (description is omitted when absent). Long entries wrap to the terminal width; Page Up/Page Down scroll the focused skill’s details if they exceed the window height. The same details appear in update search, confirmation lists, catalog listing, and import conflict choices. Checked skills stay selected when the search changes.

- Type to filter by name, category, tag, or description; Backspace edits the search.
- Use ↑/↓ to move and Space to toggle a skill.
- Ctrl+A selects or clears all current matches, leaving hidden selections intact. Ctrl+U clears the search.
- Enter reviews the complete selection. Esc or Ctrl+C cancels.

No matches? Keep typing or clear the search without restarting. Review all selected names before confirming removal (defaults to No). This removes catalog entries, not installed skill files. An empty selection makes no changes.

### `skill-installer list`

Display all cataloged skills. Filter with flags:

```bash
skill-installer list                    # all skills
skill-installer list --category react   # by category
skill-installer list --tag performance  # by tag
```

### `skill-installer install`

The main event. Interactive flow:

1. **Search and select** — use the same searchable selection list as delete
2. **Confirm** — review commands before running
3. **Execute** — runs each command sequentially with `stdio: inherit` (supports interactive installers)
4. **Summary** — final report of what succeeded/failed

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

The catalog is a JSON array stored in `catalog.json` at the repo root. Missing, unreadable, malformed, or structurally invalid catalogs produce an error instead of being treated as empty. Repair the file before editing; for a new catalog, run `skill-installer init`. Imports are validated before saving.

Example:

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

## Verification

Run `python3 tests/cli-selection.py` to check search and selection, validation recovery, Save/Cancel, the launch menu, and catalog protection in disposable catalogs through a real terminal. Requires Python 3 and Git.
