import fs from 'node:fs';
import crypto from 'node:crypto';
import { input, confirm, select, checkbox } from '@inquirer/prompts';
import { CATALOG_PATH, log } from './utils.js';
import { hasRemote, syncCatalog } from './git.js';

export function loadCatalog() {
  try {
    const data = fs.readFileSync(CATALOG_PATH, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveCatalog(catalog) {
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + '\n');
}

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

  const name = await input({ message: 'Skill name (required):' });
  if (!name.trim()) {
    log.error('✗ Name is required.');
    return;
  }

  if (catalog.some((s) => s.name === name.trim())) {
    log.error(`✗ Skill "${name.trim()}" already exists.`);
    return;
  }

  const command = await input({ message: 'Install command (required):' });
  if (!command.trim()) {
    log.error('✗ Command is required.');
    return;
  }

  // Warn on duplicate command
  const dup = catalog.find((s) => s.command === command.trim());
  if (dup) {
    log.warn(`⚠ This command matches existing skill "${dup.name}".`);
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

  const skillId = await select({
    message: 'Select skill to update:',
    choices: catalog.map((s) => ({ name: s.name, value: s.id })),
  });

  const skill = catalog.find((s) => s.id === skillId);

  const field = await select({
    message: 'Which field to edit?',
    choices: [
      { name: `name (${skill.name})`, value: 'name' },
      { name: `command (${skill.command})`, value: 'command' },
      { name: `category (${skill.category || '—'})`, value: 'category' },
      { name: `tags (${(skill.tags || []).join(', ') || '—'})`, value: 'tags' },
      { name: `description (${skill.description || '—'})`, value: 'description' },
    ],
  });

  if (field === 'tags') {
    const val = await input({
      message: 'New tags (comma-separated):',
      default: (skill.tags || []).join(', '),
    });
    skill.tags = val.split(',').map((t) => t.trim()).filter(Boolean);
  } else {
    const val = await input({
      message: `New ${field}:`,
      default: skill[field] || '',
    });
    if (field === 'name' && !val.trim()) {
      log.error('✗ Name cannot be empty.');
      return;
    }
    if (field === 'command' && !val.trim()) {
      log.error('✗ Command cannot be empty.');
      return;
    }
    if (field === 'name' && catalog.some((s) => s.name === val.trim() && s.id !== skill.id)) {
      log.error(`✗ Skill "${val.trim()}" already exists.`);
      return;
    }
    skill[field] = val.trim() || undefined;
  }

  saveCatalog(catalog);
  log.success(`✓ Updated "${skill.name}"`);

  await syncCatalog();
}

// ── Delete ────────────────────────────────────────

export async function del() {
  const catalog = loadCatalog();
  if (catalog.length === 0) {
    log.dim('No skills in catalog.');
    return;
  }

  const ids = await checkbox({
    message: 'Select skill(s) to delete:',
    choices: catalog.map((s) => ({ name: s.name, value: s.id })),
  });

  if (ids.length === 0) {
    log.dim('Nothing selected.');
    return;
  }

  const names = catalog.filter((s) => ids.includes(s.id)).map((s) => s.name);
  const ok = await confirm({ message: `Delete ${names.join(', ')}?` });
  if (!ok) return;

  const filtered = catalog.filter((s) => !ids.includes(s.id));
  saveCatalog(filtered);
  log.success(`✓ Deleted ${names.length} skill(s)`);

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

  console.log('');
  for (const s of filtered) {
    const cat = s.category ? ` [${s.category}]` : '';
    const tags = s.tags?.length ? ` (${s.tags.join(', ')})` : '';
    console.log(`  ${s.name}${cat}${tags}`);
    console.log(`    ${s.command}`);
    if (s.description) console.log(`    ${s.description}`);
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

  if (!Array.isArray(incoming)) {
    log.error('✗ Import file must contain a JSON array.');
    return;
  }

  const catalog = loadCatalog();
  let added = 0;

  for (const entry of incoming) {
    if (!entry.name || !entry.command) {
      log.warn(`⚠ Skipping entry without name/command`);
      continue;
    }

    const existing = catalog.find((s) => s.name === entry.name);
    if (existing) {
      const action = await select({
        message: `"${entry.name}" already exists. What to do?`,
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
        const newName = await input({ message: 'New name:' });
        if (!newName.trim()) continue;
        catalog.push({ ...entry, id: crypto.randomUUID(), name: newName.trim() });
        added++;
      }
    } else {
      catalog.push({ ...entry, id: entry.id || crypto.randomUUID() });
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
