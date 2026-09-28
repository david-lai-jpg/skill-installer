#!/usr/bin/env node

import { select } from '@inquirer/prompts';
import mri from 'mri';
import { HELP_TEXT, log } from '../src/utils.js';
import { init, add, update, del, list, importCatalog, exportCatalog } from '../src/catalog.js';
import { install } from '../src/installer.js';

const args = mri(process.argv.slice(2), {
  alias: { h: 'help' },
  boolean: ['help'],
});

let command = args._[0];

if (args.help || (!command && (!process.stdin.isTTY || !process.stdout.isTTY))) {
  console.log(HELP_TEXT);
  process.exit(0);
}

try {
  if (!command) {
    command = await select({
      message: 'What would you like to do?',
      choices: ['Install', 'Add', 'Update', 'Delete', 'List', 'Exit']
        .map((name) => ({ name, value: name.toLowerCase() })),
    });
  }
  switch (command) {
    case 'exit':
      break;
    case 'init':
      await init();
      break;
    case 'add':
      await add();
      break;
    case 'update':
      await update();
      break;
    case 'delete':
      await del();
      break;
    case 'list':
      list(args);
      break;
    case 'install':
      await install();
      break;
    case 'import':
      await importCatalog(args._[1]);
      break;
    case 'export':
      exportCatalog(args._[1]);
      break;
    default:
      log.error(`✗ Unknown command: ${command}`);
      console.log(HELP_TEXT);
      process.exit(1);
  }
} catch (e) {
  if (e.name === 'ExitPromptError') {
    // User pressed Ctrl+C during a prompt
    log.dim('\nCancelled.');
    process.exit(0);
  }
  log.error(`✗ ${e.message}`);
  process.exit(1);
}
