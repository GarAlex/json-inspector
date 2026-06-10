#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { compareJson, type JsonChange, type JsonValue } from "./index.js";

const HELP = `Compare two JSON documents.

Usage:
  json-compare [--json] <original.json> <updated.json>

Options:
  --json   Print the machine-readable comparison result
  --help   Show this help

Exit codes:
  0  Documents are equal
  1  Documents are different
  2  Invalid arguments, unreadable files, or invalid JSON
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(HELP);
    return;
  }

  const outputJson = args.includes("--json");
  const unknownOptions = args.filter(
    (arg) => arg.startsWith("-") && arg !== "--json",
  );
  const filePaths = args.filter((arg) => !arg.startsWith("-"));

  if (unknownOptions.length > 0 || filePaths.length !== 2) {
    process.stderr.write(HELP);
    process.exitCode = 2;
    return;
  }

  try {
    const [original, updated] = await Promise.all([
      readJsonFile(filePaths[0] as string),
      readJsonFile(filePaths[1] as string),
    ]);
    const result = compareJson(original, updated);

    if (outputJson) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      printHumanResult(result.changes);
    }

    process.exitCode = result.equal ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`json-compare: ${message}\n`);
    process.exitCode = 2;
  }
}

async function readJsonFile(filePath: string): Promise<JsonValue> {
  let source: string;

  try {
    source = await readFile(filePath, "utf8");
  } catch (error) {
    throw new Error(`cannot read "${filePath}": ${errorMessage(error)}`);
  }

  try {
    return JSON.parse(source) as JsonValue;
  } catch (error) {
    throw new Error(`invalid JSON in "${filePath}": ${errorMessage(error)}`);
  }
}

function printHumanResult(changes: JsonChange[]): void {
  if (changes.length === 0) {
    process.stdout.write("No differences found.\n");
    return;
  }

  const label = changes.length === 1 ? "difference" : "differences";
  process.stdout.write(`Found ${changes.length} ${label}:\n`);

  for (const change of changes) {
    process.stdout.write(`${formatChange(change)}\n`);
  }
}

function formatChange(change: JsonChange): string {
  const path = change.path || "(root)";

  switch (change.type) {
    case "added":
      return `+ ${path}: ${formatValue(change.value)}`;
    case "removed":
      return `- ${path}: ${formatValue(change.oldValue)}`;
    case "changed":
      return `~ ${path}: ${formatValue(change.oldValue)} -> ${formatValue(change.newValue)}`;
  }
}

function formatValue(value: JsonValue): string {
  return JSON.stringify(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

await main();
