import { checkbox, input } from '@inquirer/prompts';

import { log } from './utils.js';

export async function selectSkills(skills, message) {
  const term = await input({ message: 'Filter skills (name, category, tag, description; Enter for all):' });
  const query = term.trim().toLowerCase();
  const matches = skills.filter((skill) =>
    [skill.name, skill.category, skill.description, ...(skill.tags || [])]
      .join(' ').toLowerCase().includes(query));
  if (matches.length === 0) {
    log.dim('No skills match that filter.');
    return [];
  }

  return checkbox({
    message,
    pageSize: 15,
    loop: false,
    theme: { helpMode: 'always' },
    choices: [...matches]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((skill) => ({
        name: skill.category ? `${skill.name} [${skill.category}]` : skill.name,
        value: skill.id,
        description: [skill.description, ...(skill.tags || [])].filter(Boolean).join(' · '),
      })),
  });
}
