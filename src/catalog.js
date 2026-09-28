import fs from 'node:fs';
import crypto from 'node:crypto';
import { input, confirm, select, search } from '@inquirer/prompts';
import { selectSkills } from './selection.js';
import { CATALOG_PATH, log, skillLabel } from './utils.js';
import { hasRemote, syncCatalog } from './git.js';

export function loadCatalog() {
  let data;
  try {
    data = fs.readFileSync(CATALOG_PATH, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Catalog not found at ${CATALOG_PATH}. Run "skill-installer init" to create it.`);
    }
    throw new Error(`Cannot read catalog at ${CATALOG_PATH}: ${error.message}`);
  }

  let catalog;
  try {
    catalog = JSON.parse(data);
  } catch {
    throw new Error(`Invalid JSON in catalog at ${CATALOG_PATH}. Repair the file or replace it with a JSON array.`);
  }

  validateCatalog(catalog, `Catalog at ${CATALOG_PATH}`);
  return catalog;
}

export function saveCatalog(catalog) {
  validateCatalog(catalog, 'Catalog');
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + '\n');
}

function validateCatalog(catalog, label) {
  if (!Array.isArray(catalog)) throw new Error(`${label} must contain a JSON array.`);

  const ids = new Map();
  catalog.forEach((entry, index) => {
    const at = `${label} entry ${index + 1}`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`${at} must be an object.`);
    for (const field of ['id', 'name', 'command']) {
      if (typeof entry[field] !== 'string' || !entry[field].trim()) throw new Error(`${at} must have a non-empty string ${field}.`);
    }
    for (const field of ['category', 'description']) {
      if (entry[field] !== undefined && typeof entry[field] !== 'string') throw new Error(`${at}.${field} must be a string.`);
    }
    if (entry.tags !== undefined && (!Array.isArray(entry.tags) || entry.tags.some((tag) => typeof tag !== 'string'))) {
      throw new Error(`${at}.tags must be an array of strings.`);
    }
    if (ids.has(entry.id)) {
      throw new Error(`${label} entries ${ids.get(entry.id) + 1} and ${index + 1} have duplicate ids.`);
    }
    ids.set(entry.id, index);
  });
}

const required = (label) => (value) => value.trim() ? true : `${label} is required.`;
const uniqueName = (catalog, currentId) => (value) => {
  const requiredResult = required('Name')(value);
  if (requiredResult !== true) return requiredResult;
  return !catalog.some((skill) => skill.name === value.trim() && skill.id !== currentId) ||
    `Skill "${value.trim()}" already exists.`;
};

// ── Init ──────────────────────────────────────────

export async function init() {
  // Check Node version
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major < 18) {
    log.error(`✗ Node.js >= 18 required (current: ${process.versions.node})`);
    process.exit(1);
  }
  log.success(`✓ Node.js ${process.versions.node}`);

  // Check catalog
  if (fs.existsSync(CATALOG_PATH)) {
    const catalog = loadCatalog();
    log.info(`Catalog exists with ${catalog.length} skill(s).`);
  } else {
    fs.writeFileSync(CATALOG_PATH, '[]\n');
    log.success('✓ Created catalog.json');
  }

  // Check git remote
  if (!hasRemote()) {
    log.warn('⚠ No git remote configured. Catalog changes won\'t sync until you add one.');
  } else {
    log.success('✓ Git remote configured');
  }
}

// ── Add ───────────────────────────────────────────

export async function add() {
  const catalog = loadCatalog();

  const name = await input({
    message: 'Skill name (required):',
    validate: uniqueName(catalog),
  });

  const command = await input({ message: 'Install command (required):', validate: required('Command') });

  // Warn on duplicate command
  const dup = catalog.find((s) => s.command === command.trim());
  if (dup) {
    log.warn(`⚠ This command matches: ${skillLabel(dup)}`);
    const proceed = await confirm({ message: 'Add anyway?' });
    if (!proceed) return;
  }

  const category = await input({ message: 'Category (optional):' });
  const tagsRaw = await input({ message: 'Tags (comma-separated, optional):' });
  const description = await input({ message: 'Description (optional):' });

  const skill = {
    id: crypto.randomUUID(),
    name: name.trim(),
    command: command.trim(),
  };
  if (category.trim()) skill.category = category.trim();
  if (tagsRaw.trim()) {
    skill.tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
  }
  if (description.trim()) skill.description = description.trim();

  catalog.push(skill);
  saveCatalog(catalog);
  log.success(`✓ Added "${skill.name}"`);

  await syncCatalog();
}

// ── Update ────────────────────────────────────────

export async function update() {
  const catalog = loadCatalog();
  if (catalog.length === 0) {
    log.dim('No skills in catalog.');
    return;
  }

  const skillId = await search({
    message: 'Search skill to update:',
    source: (term) => {
      const q = (term || '').toLowerCase();
      return [...catalog]
        .filter((s) => {
          if (!q) return true;
          return [s.name, s.category, s.description, ...(s.tags || [])].join(' ').toLowerCase().includes(q);
        })
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({ name: skillLabel(s), value: s.id }));
    },
  });

  const skill = catalog.find((s) => s.id === skillId);
  const draft = structuredClone(skill);

  while (true) {
    const field = await select({
      message: 'Which field to edit?',
      choices: [
        { name: `name (${draft.name})`, value: 'name' },
        { name: `command (${draft.command})`, value: 'command' },
        { name: `category (${draft.category || '—'})`, value: 'category' },
        { name: `tags (${(draft.tags || []).join(', ') || '—'})`, value: 'tags' },
        { name: `description (${draft.description || '—'})`, value: 'description' },
        { name: 'Save', value: 'save' },
        { name: 'Cancel', value: 'cancel' },
      ],
    });

    if (field === 'cancel') return;
    if (field === 'save') break;
    if (field === 'tags') {
      const val = await input({ message: 'New tags (comma-separated):', default: (draft.tags || []).join(', ') });
      draft.tags = val.split(',').map((tag) => tag.trim()).filter(Boolean);
      continue;
    }

    const val = await input({
      message: `New ${field}:`,
      default: draft[field] || '',
      validate: field === 'name' ? uniqueName(catalog, skill.id)
        : field === 'command' ? required('Command') : undefined,
    });
    if (val.trim()) draft[field] = val.trim();
    else delete draft[field];
  }

  catalog[catalog.indexOf(skill)] = draft;
  saveCatalog(catalog);
  log.success(`✓ Updated "${draft.name}"`);

  await syncCatalog();
}

// ── Delete ────────────────────────────────────────

export async function del() {
  const catalog = loadCatalog();
  if (catalog.length === 0) {
    log.dim('No skills in catalog.');
    return;
  }

  const ids = await selectSkills(catalog, 'Select skills to remove from the catalog:');

  if (ids.length === 0) {
    log.dim('Nothing selected.');
    return;
  }

  const selected = catalog.filter((s) => ids.includes(s.id));
  console.log('\nSkills to remove from the catalog:');
  for (const skill of selected) console.log(`  ${skillLabel(skill)}`);
  const ok = await confirm({ message: `Remove ${selected.length} skill(s) from the catalog?`, default: false });
  if (!ok) return;

  const filtered = catalog.filter((s) => !ids.includes(s.id));
  saveCatalog(filtered);
  log.success(`✓ Deleted ${selected.length} skill(s)`);

  await syncCatalog();
}

// ── List ──────────────────────────────────────────

export function list(args) {
  const catalog = loadCatalog();
  if (catalog.length === 0) {
    log.dim('No skills in catalog. Use "skill-installer add" to add one.');
    return;
  }

  let filtered = catalog;

  if (args.category) {
    filtered = filtered.filter(
      (s) => s.category && s.category.toLowerCase() === args.category.toLowerCase()
    );
  }
  if (args.tag) {
    filtered = filtered.filter(
      (s) => s.tags && s.tags.some((t) => t.toLowerCase() === args.tag.toLowerCase())
    );
  }

  if (filtered.length === 0) {
    log.dim('No skills match the filter.');
    return;
  }

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  console.log('');
  for (const s of sorted) {
    const tags = s.tags?.length ? ` (${s.tags.join(', ')})` : '';
    console.log(`  ${skillLabel(s)}${tags}`);
    console.log('');
  }
  console.log(`  ${filtered.length} skill(s)`);
}

// ── Import ────────────────────────────────────────

export async function importCatalog(filePath) {
  if (!filePath) {
    log.error('✗ Usage: skill-installer import <file>');
    return;
  }

  let incoming;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    incoming = JSON.parse(raw);
  } catch (e) {
    log.error(`✗ Failed to read ${filePath}: ${e.message}`);
    return;
  }

  try {
    if (!Array.isArray(incoming)) throw new Error('Import file must contain a JSON array.');
    incoming = incoming.map((entry) =>
      entry && typeof entry === 'object' && !Array.isArray(entry)
        ? { ...entry, id: entry.id || crypto.randomUUID() }
        : entry
    );
    validateCatalog(incoming, `Import file ${filePath}`);
  } catch (error) {
    log.error(`✗ ${error.message}`);
    return;
  }

  const catalog = loadCatalog();
  let added = 0;

  for (const entry of incoming) {
    const existing = catalog.find((s) => s.name === entry.name);
    if (existing) {
      console.log(`Existing: ${skillLabel(existing)}`);
      console.log(`Incoming: ${skillLabel(entry)}`);
      const action = await select({
        message: `Skill already exists. What to do?`,
        choices: [
          { name: 'Skip', value: 'skip' },
          { name: 'Overwrite', value: 'overwrite' },
          { name: 'Rename', value: 'rename' },
        ],
      });

      if (action === 'skip') continue;
      if (action === 'overwrite') {
        Object.assign(existing, entry, { id: existing.id });
        added++;
      } else {
        const newName = await input({
          message: 'New name:',
          validate: uniqueName(catalog),
        });
        catalog.push({ ...entry, id: crypto.randomUUID(), name: newName.trim() });
        added++;
      }
    } else {
      catalog.push(entry);
      added++;
    }
  }

  saveCatalog(catalog);
  log.success(`✓ Imported ${added} skill(s)`);

  await syncCatalog();
}

// ── Export ─────────────────────────────────────────

export function exportCatalog(filePath) {
  if (!filePath) {
    log.error('✗ Usage: skill-installer export <file>');
    return;
  }

  const catalog = loadCatalog();
  fs.writeFileSync(filePath, JSON.stringify(catalog, null, 2) + '\n');
  log.success(`✓ Exported ${catalog.length} skill(s) to ${filePath}`);
}
