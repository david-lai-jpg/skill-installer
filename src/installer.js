import { spawn } from 'node:child_process';
import { confirm, select, checkbox } from '@inquirer/prompts';
import pc from 'picocolors';
import { loadCatalog } from './catalog.js';
import { log } from './utils.js';

function runCommand(command) {
  return new Promise((resolve) => {
    const child = spawn(command, { stdio: 'inherit', shell: true });
    child.on('close', (code) => resolve(code));
    child.on('error', (err) => {
      log.error(`✗ Failed to start: ${err.message}`);
      resolve(1);
    });
  });
}

export async function install() {
  const catalog = loadCatalog();
  if (catalog.length === 0) {
    log.dim('No skills in catalog. Use "skill-installer add" to add one.');
    return;
  }

  // Optional pre-filter
  const wantFilter = await confirm({ message: 'Filter by category or tag?', default: false });
  let pool = catalog;

  if (wantFilter) {
    const filterBy = await select({
      message: 'Filter by:',
      choices: [
        { name: 'Category', value: 'category' },
        { name: 'Tag', value: 'tag' },
      ],
    });

    if (filterBy === 'category') {
      const categories = [...new Set(catalog.map((s) => s.category || 'Other'))];
      const chosen = await select({
        message: 'Select category:',
        choices: categories.map((c) => ({ name: c, value: c })),
      });
      pool = catalog.filter((s) => (s.category || 'Other') === chosen);
    } else {
      const allTags = [...new Set(catalog.flatMap((s) => s.tags || []))];
      if (allTags.length === 0) {
        log.dim('No tags found.');
        pool = catalog;
      } else {
        const chosen = await select({
          message: 'Select tag:',
          choices: allTags.map((t) => ({ name: t, value: t })),
        });
        pool = catalog.filter((s) => s.tags?.includes(chosen));
      }
    }

    if (pool.length === 0) {
      log.dim('No skills match that filter.');
      return;
    }
  }

  // Group by category for display
  const grouped = {};
  for (const s of pool) {
    const cat = s.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  }

  // Build checkbox choices with category separators
  const choices = [];
  for (const [cat, skills] of Object.entries(grouped).sort(([a], [b]) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  })) {
    choices.push({ name: pc.bold(pc.dim(`── ${cat} ──`)), value: `__sep_${cat}`, disabled: '' });
    for (const s of [...skills].sort((a, b) => a.name.localeCompare(b.name))) {
      const desc = s.description ? ` — ${s.description}` : '';
      choices.push({ name: `${s.name}${pc.dim(desc)}`, value: s.id });
    }
  }

  const selectedIds = await checkbox({
    message: 'Select skills to install:',
    choices,
  });

  const selected = pool.filter((s) => selectedIds.includes(s.id));
  if (selected.length === 0) {
    log.dim('Nothing selected.');
    return;
  }

  // Confirmation
  console.log('\nSkills to install:');
  for (const s of selected) {
    console.log(`  ${s.name}: ${pc.dim(s.command)}`);
  }

  const ok = await confirm({ message: `Install these ${selected.length} skill(s)?` });
  if (!ok) return;

  // Execute sequentially
  const results = [];
  const total = selected.length;

  for (let i = 0; i < total; i++) {
    const s = selected[i];
    console.log(`\n[${i + 1}/${total}] Installing ${s.name}...`);

    const code = await runCommand(s.command);

    if (code === 0) {
      log.success(`✓ ${s.name} installed`);
      results.push({ name: s.name, ok: true });
    } else {
      log.error(`✗ ${s.name} failed (exit code ${code})`);
      results.push({ name: s.name, ok: false });

      if (i < total - 1) {
        const cont = await confirm({ message: 'Continue with remaining skills?' });
        if (!cont) {
          // Mark remaining as skipped
          for (let j = i + 1; j < total; j++) {
            results.push({ name: selected[j].name, ok: null });
          }
          break;
        }
      }
    }
  }

  // Final summary
  console.log('\n── Results ──');
  for (const r of results) {
    if (r.ok === true) log.success(`  ✓ ${r.name}`);
    else if (r.ok === false) log.error(`  ✗ ${r.name}`);
    else log.dim(`  – ${r.name} (skipped)`);
  }
}
