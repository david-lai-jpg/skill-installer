import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pc from 'picocolors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Root directory of the skill-installer tool (works when globally installed) */
export const TOOL_ROOT = path.resolve(__dirname, '..');

/** Absolute path to catalog.json */
export const CATALOG_PATH = path.join(TOOL_ROOT, 'catalog.json');

export const log = {
  success: (msg) => console.log(pc.green(msg)),
  error: (msg) => console.log(pc.red(msg)),
  warn: (msg) => console.log(pc.yellow(msg)),
  dim: (msg) => console.log(pc.dim(msg)),
  info: (msg) => console.log(msg),
};

export const HELP_TEXT = `skill-installer — Catalog and install Claude Code skills

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
  --help, -h    Show this help message`;
