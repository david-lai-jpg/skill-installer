**You are a senior Node.js CLI developer.** Build a CLI tool called `skill-installer` that manages a personal catalog of Claude Code skill installation commands and lets the user select and run them on any project.

## Context

Claude Code skills are installed via various `npx`/`pnpx` commands. Each command may have different syntax, flags, and some spawn interactive prompts that require stdin. Currently the user manually hunts through repos to find and copy-paste these commands. This tool eliminates that.

The tool is **globally installed** via `npm install -g` from its own repo. It is always run from the user's target project directory, but the catalog lives inside the tool's own repo — not the user's project.

## Module System
**Use ESM exclusively.** Set `"type": "module"` in `package.json`. Use `fileURLToPath(import.meta.url)` and `path.resolve` for path resolution. No CommonJS, no `require`, no `__dirname`.

## Core Requirements

### Help & Usage (`skill-installer --help` or no args)
When run with `--help`, `-h`, or no arguments, display:
```
skill-installer — Catalog and install Claude Code skills

Usage:
  skill-installer <command> [options]

Commands:
  init          Initialize catalog and verify git setup
  add           Add a new skill to the catalog
  update        Update an existing skill
  delete        Remove skill(s) from the catalog
  list          List all cataloged skills
  install       Select and install skills
  import <file> Import skills from a JSON file
  export <file> Export catalog to a JSON file

Options:
  --help, -h    Show this help message
```

### Init Command (`skill-installer init`)
- First-time setup: creates `catalog.json` if missing (with empty array `[]`), verifies git remote is configured, checks that Node.js >= 18 is available.
- If `catalog.json` already exists, report current skill count and exit.
- If no git remote is configured, warn: `"⚠ No git remote configured. Catalog changes won't sync until you add one."`

### Catalog Storage
- Store the catalog as a JSON file (`catalog.json`) at the **root of this tool's own repository**.
- Resolve the catalog path relative to the tool's own source using `fileURLToPath(import.meta.url)` and `path.resolve`. This must work when globally installed and run from any directory.
- Schema per entry:
  ```json
  {
    "id": "uuid-or-slug",
    "name": "vercel-react-best-practices",
    "command": "npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices",
    "category": "react",
    "tags": ["performance", "next.js"],
    "description": "Vercel's React/Next.js optimization guidelines"
  }
  ```
- `name` and `command` are required. `category`, `tags`, and `description` are optional.
- Categories are freeform strings.

### CRUD Operations
- **Add**: Prompt for name, command (required), then category, tags (comma-separated input, trimmed and split), description (optional). Validate that name is unique. If the command matches an existing entry's command, warn and ask for confirmation.
- **Update**: Select an existing skill from a list, then choose which field(s) to edit.
- **Delete**: Select one or more skills to remove, confirm before deleting.
- **List**: Display all skills in a readable table format, optionally filtered by category or tag via flags (e.g., `skill-installer list --category vue`).

### Install Flow (Select & Run)
1. **Optional pre-filter**: Ask the user if they want to filter by category or tag. If yes, narrow the skill list.
2. **Checkbox selection**: Show a single multi-select (checkbox) list of skills, grouped by category (uncategorized under "Other"). If the prompt library supports type-to-filter on checkboxes, enable it. If it doesn't, the category pre-filter from step 1 is sufficient — do not build a custom search solution.
3. **Confirmation**: Display a summary of selected skills with their commands. Ask: `"Install these X skills? (Y/n)"`
4. **Execute**: Run each selected skill's `command` sequentially with `{ stdio: 'inherit', shell: true }`.
   - Before each: `"[2/5] Installing vercel-react-best-practices..."`
   - On success: green `"✓ vercel-react-best-practices installed"`
   - On failure: red `"✗ vercel-react-best-practices failed (exit code N)"` — ask: **continue** or **abort**?
   - Final summary at the end listing all results (✓ / ✗).

### Import / Export
- **Export** (`skill-installer export <filepath>`): Write current catalog to the specified path as formatted JSON.
- **Import** (`skill-installer import <filepath>`): Read a JSON file and merge into catalog. On name collision, ask per-entry: skip, overwrite, or rename. After import, trigger git sync.

### Git Sync
- After every catalog mutation (add/update/delete/import):
  1. `cd` into the tool's repo directory
  2. Pull latest from remote (if remote exists). If pull fails, warn and proceed.
  3. Stage `catalog.json`
  4. Commit with message: `"update skill catalog"`
  5. Push to remote
- If push fails: yellow `"⚠ Push failed: <reason>. Local commit preserved — push manually when ready."`
- If pull produces a merge conflict: warn and abort the mutation.

### Color-Coded Output
Use `picocolors` (zero-dependency, smallest option):
- **Green**: Success, installed confirmations
- **Red**: Errors, failed installations
- **Yellow**: Warnings (push failures, duplicates, no remote)
- **Dim/gray**: Secondary info, skipped items

## Technical Constraints
- **Runtime**: Node.js (>=18). Globally installed via `npm install -g`.
- **Module system**: ESM only. `"type": "module"` in package.json.
- **Interactive UI**: Use `@inquirer/prompts` for all interactive prompts.
- **No framework overkill**: No `oclif`, no `commander`. Parse commands from `process.argv` directly or use a minimal parser like `mri`.
- **Execution**: `child_process.spawn` with `{ stdio: 'inherit', shell: true }`.
- **Error handling**: Never silently swallow errors. Log what failed and why.
- **Single user**: No auth, no multi-tenancy.
- **Binary name**: `skill-installer` only. No aliases.

## File Structure
```
skill-installer/
├── bin/cli.js          # entry point with #!/usr/bin/env node, arg routing
├── src/
│   ├── catalog.js      # CRUD operations on catalog.json
│   ├── installer.js    # select & run flow
│   ├── git.js          # git sync operations
│   └── utils.js        # colors, path resolution, helpers
├── catalog.json        # the skill catalog (committed)
├── package.json
└── README.md
```

## Out of Scope
- Do NOT build a plugin/registry system
- Do NOT implement version tracking of installed skills
- Do NOT manage or modify the skills themselves after installation
- Do NOT add telemetry, analytics, or update checks
- The tool's only job is to catalog commands and run them. The install commands handle everything else.
