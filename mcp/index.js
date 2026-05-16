#!/usr/bin/env node
// MCP server for the learnings-discipline plugin.
//
// Hand-rolled JSON-RPC 2.0 over stdin/stdout with LSP-style framing
// (Content-Length headers). No external dependencies. Implements just enough
// of the MCP spec (2024-11-05) to expose 8 tools.

import learnings_read, { schema as s_read } from './tools/learnings_read.js';
import learnings_relevant_sections, { schema as s_rel } from './tools/learnings_relevant_sections.js';
import learnings_append_section, { schema as s_app } from './tools/learnings_append_section.js';
import learnings_capture_failure, { schema as s_fail } from './tools/learnings_capture_failure.js';
import learnings_capture_win, { schema as s_win } from './tools/learnings_capture_win.js';
import learnings_audit, { schema as s_audit } from './tools/learnings_audit.js';
import thoughts_create, { schema as s_thoughts } from './tools/thoughts_create.js';
import template_get, { schema as s_tpl } from './tools/template_get.js';

const TOOLS = {
  learnings_read: { handler: learnings_read, schema: s_read },
  learnings_relevant_sections: { handler: learnings_relevant_sections, schema: s_rel },
  learnings_append_section: { handler: learnings_append_section, schema: s_app },
  learnings_capture_failure: { handler: learnings_capture_failure, schema: s_fail },
  learnings_capture_win: { handler: learnings_capture_win, schema: s_win },
  learnings_audit: { handler: learnings_audit, schema: s_audit },
  thoughts_create: { handler: thoughts_create, schema: s_thoughts },
  template_get: { handler: template_get, schema: s_tpl },
};

const SERVER_INFO = { name: 'learnings', version: '0.1.0' };
const PROTOCOL_VERSION = '2024-11-05';

function send(message) {
  const json = JSON.stringify(message);
  const payload = Buffer.from(json, 'utf8');
  const header = `Content-Length: ${payload.length}\r\n\r\n`;
  process.stdout.write(header);
  process.stdout.write(payload);
}

function makeError(id, code, message, data) {
  const err = { code, message };
  if (data !== undefined) err.data = data;
  return { jsonrpc: '2.0', id, error: err };
}

async function handleRequest(req) {
  const { id, method, params } = req;
  try {
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        },
      };
    }
    if (method === 'initialized' || method === 'notifications/initialized') {
      return null; // notification, no response
    }
    if (method === 'tools/list') {
      const tools = Object.values(TOOLS).map(t => t.schema);
      return { jsonrpc: '2.0', id, result: { tools } };
    }
    if (method === 'tools/call') {
      const name = params?.name;
      const args = params?.arguments || {};
      const tool = TOOLS[name];
      if (!tool) {
        const errBody = { error: { code: 'UNKNOWN_TOOL', message: `No such tool: ${name}` } };
        return {
          jsonrpc: '2.0', id,
          result: {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify(errBody) }],
          },
        };
      }
      let result;
      try {
        result = await tool.handler(args);
      } catch (e) {
        const errBody = { error: { code: 'TOOL_EXCEPTION', message: String(e && e.message || e) } };
        return {
          jsonrpc: '2.0', id,
          result: {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify(errBody) }],
          },
        };
      }
      const isError = !!(result && result.error);
      return {
        jsonrpc: '2.0', id,
        result: {
          isError,
          content: [{ type: 'text', text: JSON.stringify(result) }],
        },
      };
    }
    if (method === 'ping') {
      return { jsonrpc: '2.0', id, result: {} };
    }
    return makeError(id, -32601, `Method not found: ${method}`);
  } catch (e) {
    return makeError(id, -32603, `Internal error: ${e && e.message || e}`);
  }
}

// Stdin framing: parse Content-Length: N\r\n\r\n<N bytes JSON> repeatedly.
let buffer = Buffer.alloc(0);

async function processBuffer() {
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) return;
    const header = buffer.slice(0, headerEnd).toString('utf8');
    const m = /Content-Length:\s*(\d+)/i.exec(header);
    if (!m) {
      // Malformed; drop everything up to header end and continue.
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }
    const length = parseInt(m[1], 10);
    const total = headerEnd + 4 + length;
    if (buffer.length < total) return;
    const body = buffer.slice(headerEnd + 4, total).toString('utf8');
    buffer = buffer.slice(total);
    let req;
    try {
      req = JSON.parse(body);
    } catch (e) {
      send(makeError(null, -32700, 'Parse error'));
      continue;
    }
    const response = await handleRequest(req);
    if (response !== null && req.id !== undefined) {
      send(response);
    }
  }
}

process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  processBuffer().catch(e => {
    process.stderr.write(`[learnings-mcp] processBuffer error: ${e && e.stack || e}\n`);
  });
});

process.stdin.on('end', () => {
  process.exit(0);
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
