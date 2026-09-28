"""Run with python3 tests/cli-selection.py. Uses disposable catalogs and real terminal input."""
import errno
import json
import os
from pathlib import Path
import pty
import select
import shutil
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
ENV = {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}
ENV.update(TERM='xterm', NO_COLOR='1', GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL='/dev/null')
SKILLS = [dict(id=name, name=name, command=f'echo {name} >> installed.txt')
          for name in ['Charlie', 'Alpha', 'Bravo']]


def scenario(command, actions, remaining, installed=None, empty=False, query=""):
    with tempfile.TemporaryDirectory(prefix='skill-selection-') as directory:
        root = Path(directory)
        for folder in ['src', 'bin']:
            shutil.copytree(ROOT / folder, root / folder)
        shutil.copy(ROOT / 'package.json', root)
        (root / 'node_modules').symlink_to(ROOT / 'node_modules', target_is_directory=True)
        catalog = [] if empty else SKILLS
        (root / 'catalog.json').write_text(json.dumps(catalog))
        for args in [('init', '-q'), ('config', 'user.name', 'CLI test'),
                     ('config', 'user.email', 'cli@example.invalid'),
                     ('config', 'core.hooksPath', '/dev/null'), ('add', 'catalog.json'),
                     ('commit', '-qm', 'fixture')]:
            subprocess.run(['git', '-C', directory, *args], env=ENV, check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        master, slave = pty.openpty()
        process = subprocess.Popen(['node', 'bin/cli.js', command], cwd=root, env=ENV,
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
            if not empty:
                at = 1 if command == 'install' else 0
                actions.insert(at, ('Filter skills', query + '\r'))
            for expected, keys in actions:
                read_until(expected)
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
            assert process.poll() == 0, output
            assert [s['name'] for s in json.loads((root / 'catalog.json').read_text())] == remaining
            actual = (root / 'installed.txt').read_text().splitlines() if (root / 'installed.txt').exists() else []
            assert actual == (installed or []), actual
            assert 'Delete another?' not in output and 'Add another skill?' not in output
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()
            os.close(master)


original = [s['name'] for s in SKILLS]
scenario('delete', [('Select skills to remove', '\r'), ('Nothing selected.', '')], original)
scenario('delete', [('Select skills to remove', ' 2\r'), ('Remove 2 skill(s)', '\r')], original)
scenario('delete', [('Select skills to remove', ' 2\r'), ('Remove 2 skill(s)', 'y\r'), ('Deleted 2 skill(s)', '')], ['Charlie'])
scenario('delete', [('Select skills to remove', 'a\r'), ('Remove 3 skill(s)', 'y\r'), ('Deleted 3 skill(s)', '')], [])
scenario('delete', [('Select skills to remove', 'aa\r'), ('Nothing selected.', '')], original)
scenario('delete', [('Select skills to remove', '\x03'), ('Cancelled.', '')], original)
scenario('delete', [('No skills in catalog.', '')], [], empty=True)
scenario('install', [('Filter by category or tag?', '\r'), ('Select skills to install', ' 2\r'),
                     ('Install these 2 skill(s)?', 'y\r'), ('Results', '')], original, ['Alpha', 'Bravo'])
scenario('delete', [('Select skills to remove', 'a\r'), ('Remove 1 skill(s)', 'y\r'), ('Deleted 1 skill(s)', '')], ['Charlie', 'Alpha'], query='bRaVo')
scenario('delete', [('No skills match', ''), ('Nothing selected.', '')], original, query='missing')
print('PASS: 10 terminal scenarios; disposable catalogs only.')
