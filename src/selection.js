import readline from 'node:readline';
import pc from 'picocolors';
import { skillLabel } from './utils.js';

// Keep catalog text from being interpreted as terminal control sequences.
const display = (text) => String(text).replace(/[\x00-\x1f\x7f-\x9f]/g, '');

// Conservatively reserve two columns for non-ASCII graphemes (CJK/emoji).
// This can leave spare space for accented text, but never splits a grapheme.
function wrapLabel(text, width, nameLength = 0) {
  const lines = [];
  let line = '';
  let columns = 0;
  for (const { segment } of new Intl.Segmenter().segment(text)) {
    const size = /^[\x20-\x7e]$/.test(segment) ? 1 : 2;
    if (columns + size > width && line) {
      lines.push(line);
      line = '';
      columns = 0;
    }
    line += segment;
    columns += size;
  }
  lines.push(line);
  return lines.map((part) => {
    const end = Math.min(nameLength, part.length);
    nameLength -= end;
    return end ? pc.bold(pc.cyan(part.slice(0, end))) + part.slice(end) : part;
  });
}

export function selectSkills(skills, message) {
  const { stdin, stdout } = process;
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error('Skill selection needs an interactive terminal.');
  }
  const sorted = [...skills].sort((a, b) => a.name.localeCompare(b.name));
  const selected = new Set();
  let query = '';
  let active = 0;
  let firstVisible = 0;
  let detailOffset = 0;
  const matches = () => sorted.filter((skill) =>
    [skill.name, skill.category, skill.description, ...(skill.tags || [])]
      .join(' ').toLowerCase().includes(query.toLowerCase()));

  return new Promise((resolve, reject) => {
    const wasRaw = stdin.isRaw;
    let cleaned = false;
    const signals = new Map(['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal, index) =>
      [signal, () => { cleanup(); process.exit([130, 143, 129][index]); }]));
    readline.emitKeypressEvents(stdin);

    function render() {
      const visible = matches();
      const height = Math.max(1, (stdout.rows || 24) - 7);
      const width = Math.max(2, (stdout.columns || 80) - 6);
      const entries = visible.map((skill, index) => wrapLabel(skillLabel(skill, false), width, skillLabel({ name: skill.name }, false).length)
        .map((line, part) => `${part ? '      ' : `${index === active ? '›' : ' '} [${selected.has(skill.id) ? 'x' : ' '}] `}${line}`));
      firstVisible = Math.min(firstVisible, active);
      while (firstVisible < active && entries.slice(firstVisible, active + 1).flat().length > height) firstVisible++;
      detailOffset = Math.min(detailOffset, Math.max(0, (entries[active]?.length || 0) - height));
      if (detailOffset) firstVisible = active;
      const rows = entries.slice(firstVisible).flat().slice(detailOffset, detailOffset + height);
      const lines = [message, `Search: ${query}`, `${selected.size} selected · ${visible.length} matches`,
        'Type to filter · ↑↓ move · Space toggle · Ctrl+A toggle matches',
        'Ctrl+U clear search · Enter review · Esc/Ctrl+C cancel', 'PgUp/PgDn scroll skill details'].map(display);
      lines.push(...(rows.length ? rows : ['No matches. Edit your search or press Ctrl+U.']));
      stdout.write('\x1b[H\x1b[2J' + lines.join('\r\n'));
    }

    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      process.removeListener('exit', cleanup);
      for (const [signal, handler] of signals) process.removeListener(signal, handler);
      stdin.removeListener('keypress', onKey);
      stdout.removeListener('resize', render);
      stdin.setRawMode(wasRaw);
      stdin.pause();
      stdout.write('\x1b[?7h\x1b[?25h\x1b[?1049l');
    }

    function finish(cancelled = false) {
      cleanup();
      if (cancelled) {
        const error = new Error('Cancelled.');
        error.name = 'ExitPromptError';
        reject(error);
      } else {
        resolve(sorted.filter((skill) => selected.has(skill.id)).map((skill) => skill.id));
      }
    }

    function toggleMatches(visible) {
      const clear = visible.every((skill) => selected.has(skill.id));
      for (const skill of visible) {
        if (clear) selected.delete(skill.id);
        else selected.add(skill.id);
      }
    }

    function onKey(text, key = {}) {
      const visible = matches();
      const previousQuery = query;
      const previousActive = active;
      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) return finish(true);
      if (key.name === 'return') return finish();
      if (key.ctrl && key.name === 'a') toggleMatches(visible);
      else if (key.ctrl && key.name === 'u') { query = ''; active = 0; }
      else if (key.name === 'up') active = Math.max(0, active - 1);
      else if (key.name === 'down') active = Math.min(Math.max(0, visible.length - 1), active + 1);
      else if (key.name === 'pagedown' || key.name === 'pageup') {
        const height = Math.max(1, (stdout.rows || 24) - 7);
        const count = visible[active] ? wrapLabel(skillLabel(visible[active], false), Math.max(2, (stdout.columns || 80) - 6)).length : 0;
        detailOffset = Math.max(0, Math.min(Math.max(0, count - height), detailOffset + (key.name === 'pagedown' ? height : -height)));
      }
      else if (key.name === 'space') {
        const id = visible[active]?.id;
        if (id !== undefined) {
          if (selected.has(id)) selected.delete(id);
          else selected.add(id);
        }
      } else if (key.name === 'backspace') {
        query = [...query].slice(0, -1).join('');
        active = 0;
      } else if (text && !key.ctrl && !key.meta && !/[\x00-\x1f\x7f]/.test(text)) {
        query += text;
        active = 0;
      }
      if (query !== previousQuery || active !== previousActive) detailOffset = 0;
      render();
    }

    process.once('exit', cleanup);
    for (const [signal, handler] of signals) process.once(signal, handler);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('keypress', onKey);
    stdout.on('resize', render);
    stdout.write('\x1b[?1049h\x1b[?25l\x1b[?7l');
    render();
  });
}
