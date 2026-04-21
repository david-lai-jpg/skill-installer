import { spawn } from 'node:child_process';
import { confirm, select, search } from '@inquirer/prompts';
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

  // Search-and-select loop
  const selected = [];
  const selectedIds = new Set();

  while (true) {
    const remaining = pool.filter((s) => !selectedIds.has(s.id));
    if (remaining.length === 0) {
      log.dim('All skills selected.');
      break;
    }

    if (selected.length > 0) {
      console.log(pc.dim(`Selected so far: ${selected.map((s) => s.name).join(', ')}`));
    }

    const skillId = await search({
      message: `Search skills (${remaining.length} available):`,
      source: (term) => {
        const q = (term || '').toLowerCase();
        return remaining
          .filter((s) => {
            if (!q) return true;
            const haystack = [s.name, s.category, s.description, ...(s.tags || [])].join(' ').toLowerCase();
            return haystack.includes(q);
          })
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((s) => {
            const cat = s.category ? pc.dim(`[${s.category}]`) : '';
            const desc = s.description ? pc.dim(` — ${s.description}`) : '';
            return { name: `${s.name} ${cat}${desc}`, value: s.id };
          });
      },
    });

    const skill = pool.find((s) => s.id === skillId);
    selected.push(skill);
    selectedIds.add(skill.id);
    log.success(`+ ${skill.name}`);

    if (remaining.length <= 1) break;
    const more = await confirm({ message: 'Add another skill?', default: true });
    if (!more) break;
  }

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
