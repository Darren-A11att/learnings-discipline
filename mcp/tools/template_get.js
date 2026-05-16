import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const KIND_TO_FILE = {
  'claudemd': 'CLAUDE.md.tmpl',
  'learnings': 'LEARNINGS.md.tmpl',
  'thoughts-perspective': 'thoughts-perspective.md.tmpl',
  'thoughts-plan': 'thoughts-plan.md.tmpl',
};

export default async function template_get(args) {
  const project_type = String(args?.project_type || 'generic');
  const kind = String(args?.kind || '');
  const file = KIND_TO_FILE[kind];
  if (!file) {
    return { error: { code: 'INVALID_KIND', message: `Unknown kind "${kind}"; expected one of ${Object.keys(KIND_TO_FILE).join(', ')}` } };
  }

  const root = process.env.CLAUDE_PLUGIN_ROOT || join(process.cwd(), '..');
  const candidates = [
    join(root, 'templates', 'project-types', project_type, file),
    join(root, 'templates', file),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      const body = readFileSync(path, 'utf8');
      return { body, source: path };
    }
  }
  return { error: { code: 'TEMPLATE_NOT_FOUND', message: `No template found for kind=${kind}, project_type=${project_type}` } };
}

export const schema = {
  name: 'template_get',
  description:
    'Return the contents of a scaffold template. Checks templates/project-types/<type>/<kind>.md.tmpl first, then templates/<kind>.md.tmpl. Use this when running /learn init or any time you need the canonical CLAUDE.md, LEARNINGS.md, or thoughts template.',
  inputSchema: {
    type: 'object',
    properties: {
      project_type: { type: 'string', description: 'Project type override (e.g. android-mod, web-app). Default "generic".' },
      kind: { type: 'string', enum: ['claudemd', 'learnings', 'thoughts-perspective', 'thoughts-plan'], description: 'Which template kind.' },
    },
    required: ['kind'],
    additionalProperties: false,
  },
};
