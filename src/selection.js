import readline from 'node:readline';

// Keep catalog text from being interpreted as terminal control sequences.
const display = (text) => String(text).replace(/[\x00-\x1f\x7f-\x9f]/g, '');

export function selectSkills(skills, message) {
  const { stdin, stdout } = process;
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error('Skill selection needs an interactive terminal.');
  }
  const sorted = [...skills].sort((a, b) => a.name.localeCompare(b.name));
  const selected = new Set();
  let query = '';
  let active = 0;
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
      const pageSize = Math.max(1, (stdout.rows || 24) - 9);
      const start = Math.floor(active / pageSize) * pageSize;
      const rows = visible.slice(start, start + pageSize).map((skill, index) =>
        `${start + index === active ? '›' : ' '} [${selected.has(skill.id) ? 'x' : ' '}] ${skill.name}${skill.category ? ` [${skill.category}]` : ''}`);
      const focus = visible[active];
      const lines = [message, `Search: ${query}`, `${selected.size} selected · ${visible.length} matches`,
        'Type to filter · ↑↓ move · Space toggle · Ctrl+A toggle matches',
        'Ctrl+U clear search · Enter review · Esc/Ctrl+C cancel', '',
        ...(rows.length ? rows : ['No matches. Edit your search or press Ctrl+U.']), '',
        focus?.description || ''];
      stdout.write('\x1b[H\x1b[2J' + lines.map(display).join('\r\n'));
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
      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) return finish(true);
      if (key.name === 'return') return finish();
      if (key.ctrl && key.name === 'a') toggleMatches(visible);
      else if (key.ctrl && key.name === 'u') { query = ''; active = 0; }
      else if (key.name === 'up') active = Math.max(0, active - 1);
      else if (key.name === 'down') active = Math.min(Math.max(0, visible.length - 1), active + 1);
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
