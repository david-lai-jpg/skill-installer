"""Run with python3 tests/cli-selection.py. Uses disposable catalogs and real terminal input."""
import errno
import json
import os
from pathlib import Path
import pty
import select
import shutil
import signal
import subprocess
import tempfile
import time

artifact_fd, artifact_path = tempfile.mkstemp(prefix='skill-installer-ux-', suffix='.log')
os.close(artifact_fd)
ARTIFACT = Path(artifact_path)

ROOT = Path(__file__).resolve().parents[1]
ENV = {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}
ENV.update(TERM='xterm', NO_COLOR='1', GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL='/dev/null')
SKILLS = [dict(id=name, name=name, command=f'echo {name} >> installed.txt')
          for name in ['Charlie', 'Alpha', 'Bravo']]


def scenario(command, actions, remaining, installed=None, empty=False, fields=None, raw=None, exit_code=0):
    with tempfile.TemporaryDirectory(prefix='skill-selection-') as directory:
        root = Path(directory)
        for folder in ['src', 'bin']:
            shutil.copytree(ROOT / folder, root / folder)
        shutil.copy(ROOT / 'package.json', root)
        (root / 'node_modules').symlink_to(ROOT / 'node_modules', target_is_directory=True)
        catalog = [] if empty else SKILLS
        before = raw if raw is not None else json.dumps(catalog)
        (root / 'catalog.json').write_text(before)
        for args in [('init', '-q'), ('config', 'user.name', 'CLI test'),
                     ('config', 'user.email', 'cli@example.invalid'),
                     ('config', 'core.hooksPath', '/dev/null'), ('add', 'catalog.json'),
                     ('commit', '-qm', 'fixture')]:
            subprocess.run(['git', '-C', directory, *args], env=ENV, check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        master, slave = pty.openpty()
        process = subprocess.Popen(['node', 'bin/cli.js', *([command] if command else [])], cwd=root, env=ENV,
                                   stdin=slave, stdout=slave, stderr=slave, start_new_session=True)
        os.close(slave)
        output = ''
        cursor = 0

        def read_until(expected):
            nonlocal output, cursor
            deadline = time.monotonic() + 8
            while expected not in output[cursor:]:
                if time.monotonic() > deadline:
                    raise AssertionError(f'Timed out waiting for {expected!r}:\n{output}')
                if select.select([master], [], [], 0.1)[0]:
                    try:
                        data = os.read(master, 65536)
                    except OSError as error:
                        if error.errno != errno.EIO:
                            raise
                        data = b''
                    if not data:
                        raise AssertionError(f'Exited before {expected!r}:\n{output}')
                    output += data.decode(errors='replace')
            cursor = output.index(expected, cursor) + len(expected)

        try:
            for expected, keys in actions:
                read_until(expected)
                if isinstance(keys, int):
                    process.send_signal(keys)
                    continue
                if keys:
                    time.sleep(0.15)
                    # Separate keypresses so the real prompt receives each event.
                    for key in keys:
                        os.write(master, key.encode())
                        time.sleep(0.08)
            deadline = time.monotonic() + 8
            while process.poll() is None and time.monotonic() < deadline:
                if select.select([master], [], [], 0.1)[0]:
                    try:
                        output += os.read(master, 65536).decode(errors='replace')
                    except OSError as error:
                        if error.errno != errno.EIO:
                            raise
            assert process.poll() == exit_code, output
            if '\x1b[?1049h' in output:
                assert '\x1b[?1049l' in output, 'Terminal not restored'
                assert '\x1b[?25h' in output, 'Cursor not restored'
            saved = (root / 'catalog.json').read_text()
            if raw is not None:
                assert saved == before
                assert 'SENSITIVE_MARKER' not in output
            else:
                entries = json.loads(saved)
                assert [s['name'] for s in entries] == remaining
                if fields:
                    for name, expected in fields.items():
                        entry = next(s for s in entries if s['name'] == name)
                        assert all(entry.get(k) == v for k, v in expected.items()), entry
            actual = (root / 'installed.txt').read_text().splitlines() if (root / 'installed.txt').exists() else []
            assert actual == (installed or []), actual
            assert 'Delete another?' not in output and 'Add another skill?' not in output
        finally:
            with ARTIFACT.open('a') as artifact:
                artifact.write(f'\n=== {command or "menu"} ===\n{output}\n')
            if process.poll() is None:
                process.kill()
                process.wait()
            os.close(master)


original = [s['name'] for s in SKILLS]
scenario('delete', [('Select skills to remove', '\r'), ('Nothing selected.', '')], original)
scenario('delete', [('Select skills to remove', 'Alpha '), ('1 selected', '\x15Bravo \r'), ('Remove 2 skill(s)', '\r')], original)
scenario('delete', [('Select skills to remove', 'Alpha '), ('1 selected', '\x15Bravo \r'), ('Remove 2 skill(s)', 'y\r'), ('Deleted 2 skill(s)', '')], ['Charlie'])
scenario('delete', [('Select skills to remove', '\x01\r'), ('Remove 3 skill(s)', 'y\r'), ('Deleted 3 skill(s)', '')], [])
scenario('delete', [('Select skills to remove', '\x01\x01\r'), ('Nothing selected.', '')], original)
scenario('delete', [('Select skills to remove', '\x03'), ('Cancelled.', '')], original)
scenario('delete', [('No skills in catalog.', '')], [], empty=True)
scenario('install', [('Select skills to install', 'Alpha '), ('1 selected', '\x15Bravo \r'),
                     ('Install these 2 skill(s)?', 'y\r'), ('Results', '')], original, ['Alpha', 'Bravo'])
scenario('delete', [('Select skills to remove', 'bRaVo\x01\r'), ('Remove 1 skill(s)', 'y\r'), ('Deleted 1 skill(s)', '')], ['Charlie', 'Alpha'])
scenario('delete', [('Select skills to remove', 'missing'), ('No matches', '\x15Alpha \r'), ('Remove 1 skill(s)', 'y\r'), ('Deleted 1 skill(s)', '')], ['Charlie', 'Bravo'])
scenario('', [('What would you like to do?', '\x03'), ('Cancelled.', '')], original)
scenario('--help', [('Usage:', '')], original)
DOWN = '\x1b[B'
UP = '\x1b[A'
scenario('', [('What would you like to do?', '\r'), ('Select skills to install', 'Alpha \r'), ('Install these 1 skill(s)?', 'n\r')], original)
scenario('', [('What would you like to do?', DOWN * 4 + '\r'), ('3 skill(s)', '')], original)
scenario('add', [('Skill name', '\r'), ('Name is required.', 'Alpha\r'), ('already exists.', '\x15Delta\r'),
                 ('Install command', '\r'), ('Command is required.', 'echo Delta\r'),
                 ('Category', '\r'), ('Tags', '\r'), ('Description', '\r'), ('Added "Delta"', '')], original + ['Delta'])
scenario('update', [('Search skill to update', 'Alpha\r'), ('Which field', '\r'),
                    ('New name', 'Delta\r'), ('Which field', DOWN * 2 + '\r'),
                    ('New category', 'Testing\r'), ('Which field', DOWN * 5 + '\r'), ('Updated "Delta"', '')],
         ['Charlie', 'Delta', 'Bravo'], fields={'Delta': {'category': 'Testing'}})
scenario('update', [('Search skill to update', 'Alpha\r'), ('Which field', '\r'),
                    ('New name', 'Delta\r'), ('Which field', UP + '\r')], original)
scenario('update', [('Search skill to update', 'Alpha\r'), ('Which field', '\r'),
                    ('New name', 'Delta\r'), ('Which field', '\x03'), ('Cancelled.', '')], original)
scenario('update', [('Search skill to update', 'Alpha\r'), ('Which field', '\r'),
                    ('New name', 'Bravo\r'), ('already exists.', '\x15Delta\r'),
                    ('Which field', DOWN * 5 + '\r'), ('Updated "Delta"', '')], ['Charlie', 'Delta', 'Bravo'])
scenario('add', [('Invalid JSON in catalog at', '')], original, raw='{"SENSITIVE_MARKER":', exit_code=1)
scenario('add', [('must contain a JSON array', '')], original, raw='{}', exit_code=1)
scenario('add', [('duplicate', '')], original, raw=json.dumps([SKILLS[0], SKILLS[0]]), exit_code=1)
scenario('delete', [('Select skills to remove', signal.SIGTERM)], original, exit_code=143)
master, slave = pty.openpty()
try:
    result = subprocess.run(['node', str(ROOT / 'bin/cli.js')], stdin=slave, capture_output=True, timeout=5)
    assert result.returncode == 0 and b'Usage:' in result.stdout and b'What would' not in result.stdout
finally:
    os.close(master)
    os.close(slave)
print(f'PASS: 24 terminal scenarios; disposable catalogs only. Transcript: {ARTIFACT}')
