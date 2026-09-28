import { spawn } from 'node:child_process';
import { confirm } from '@inquirer/prompts';
import pc from 'picocolors';
import { selectSkills } from './selection.js';
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

  const ids = await selectSkills(catalog, 'Select skills to install:');
  const selected = ids.map((id) => catalog.find((skill) => skill.id === id));

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
