#!/usr/bin/env node
// MCP scaffold. Scans --root, then exposes tools built from that scan.
// Stdio framing: one JSON-RPC message per line, or a Content-Length header.
// No vendor network. Exit 2 when --root is missing (did not run).
import { createInterface } from "node:readline";
import { scan } from "./scan.mjs";
import { bootstrap } from "./bootstrap.mjs";

const PROTOCOL = "2024-11-05";

export function toolFor(job) {
  return {
    name: job.id.replaceAll("-", "_"),
    description: `${job.reason} Evidence on this job: ${job.evidence}. Persona: ${job.persona}.`,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
  };
}

export function createState(root) {
  const scanned = scan(root);
  const built = bootstrap(scanned);
  const tools = [
    {
      name: "canon_scan",
      description: "Re-scan the root. Every fact carries an evidence class. Drift sources are listed even when no data-element attribute was found.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
    },
    ...built.jobs.jobs.map(toolFor),
  ];
  return { root, scanned, built, tools };
}

export function handleMessage(state, message) {
  if (!message || message.jsonrpc !== "2.0") {
    return { jsonrpc: "2.0", id: message?.id ?? null, error: { code: -32600, message: "invalid request" } };
  }
  if (message.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: "canon-bootstrap", version: "0.1.0" },
        instructions: "Tools were erected from a scan. Job definitions are what spec/personas/orchestrator.mjs assign reads. The adoption level is design-class. Facts are observed or tested as stamped.",
      },
    };
  }
  if (message.method === "tools/list") {
    return { jsonrpc: "2.0", id: message.id, result: { tools: state.tools } };
  }
  if (message.method === "tools/call") {
    const name = message.params?.name;
    if (name === "canon_scan") {
      state.scanned = scan(state.root);
      state.built = bootstrap(state.scanned);
      state.tools = [state.tools[0], ...state.built.jobs.jobs.map(toolFor)];
      return toolResult(message.id, state.built);
    }
    const job = state.built.jobs.jobs.find((item) => item.id.replaceAll("-", "_") === name);
    if (!job) {
      return { jsonrpc: "2.0", id: message.id, error: { code: -32602, message: `unknown tool ${name}` } };
    }
    const related = state.scanned.facts.filter((fact) => job.files.includes(fact.file) || state.scanned.drift.includes(fact.kind));
    return toolResult(message.id, { job, facts: related, level: state.scanned.level, levelEvidence: state.scanned.levelEvidence });
  }
  if (typeof message.method === "string" && message.method.startsWith("notifications/")) {
    return null;
  }
  return { jsonrpc: "2.0", id: message.id ?? null, error: { code: -32601, message: `method not found: ${message.method}` } };
}

function toolResult(id, value) {
  return {
    jsonrpc: "2.0",
    id,
    result: { content: [{ type: "text", text: JSON.stringify(value) }] },
  };
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function write(message) {
  if (!message) return;
  process.stdout.write(JSON.stringify(message) + "\n");
}

if (process.argv[1]?.endsWith("server.mjs")) {
  const root = arg("root");
  if (!root) {
    process.stderr.write("canon-bootstrap did not run: --root <directory> is required\n");
    process.exit(2);
  }
  const state = createState(root);
  const rl = createInterface({ input: process.stdin });
  let pending = "";
  rl.on("close", () => process.exit(0));
  rl.on("line", (line) => {
    if (line.startsWith("Content-Length:")) {
      pending = line;
      return;
    }
    if (pending && line.trim() === "") return;
    const raw = line.trim();
    if (!raw.startsWith("{")) return;
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    write(handleMessage(state, message));
  });
}
