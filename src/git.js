import { execFileSync } from 'node:child_process';
import { TOOL_ROOT, log } from './utils.js';

/** Run a git command with fixed arguments (no shell, no injection risk) */
function git(...args) {
  return execFileSync('git', args, { cwd: TOOL_ROOT, encoding: 'utf8', stdio: 'pipe' }).trim();
}

export function hasRemote() {
  try {
    const remotes = git('remote');
    return remotes.length > 0;
  } catch {
    return false;
  }
}

export async function syncCatalog() {
  const remote = hasRemote();

  try {
    // Stage and commit local changes first (before pull)
    git('add', 'catalog.json');

    try {
      git('diff', '--cached', '--quiet');
      // No changes to commit
      return true;
    } catch {
      // There are staged changes — commit them
    }

    git('commit', '-m', 'update skill catalog');

    // Pull --rebase replays our commit on top of remote
    if (remote) {
      try {
        git('pull', '--rebase');
      } catch (e) {
        const msg = e.stderr || e.message;
        if (msg.includes('CONFLICT')) {
          log.error('✗ Merge conflict detected during rebase. Aborting.');
          log.warn('  Resolve the conflict manually in the tool repo and retry.');
          git('rebase', '--abort');
          return false;
        }
        log.warn(`⚠ Pull failed: ${msg.split('\n')[0]}. Local commit preserved — push manually when ready.`);
      }
    }

    // Push if remote exists
    if (remote) {
      try {
        git('push');
      } catch (e) {
        const msg = e.stderr || e.message;
        log.warn(`⚠ Push failed: ${msg.split('\n')[0]}. Local commit preserved — push manually when ready.`);
      }
    }

    return true;
  } catch (e) {
    log.error(`✗ Git sync failed: ${e.message}`);
    return false;
  }
}
