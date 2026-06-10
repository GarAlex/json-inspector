#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { compareJson } from "./index.js";
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
async function main() {
    const args = process.argv.slice(2);
    if (args.includes("--help") || args.includes("-h")) {
        process.stdout.write(HELP);
        return;
    }
    const outputJson = args.includes("--json");
    const unknownOptions = args.filter((arg) => arg.startsWith("-") && arg !== "--json");
    const filePaths = args.filter((arg) => !arg.startsWith("-"));
    if (unknownOptions.length > 0 || filePaths.length !== 2) {
        process.stderr.write(HELP);
        process.exitCode = 2;
        return;
    }
    try {
        const [original, updated] = await Promise.all([
            readJsonFile(filePaths[0]),
            readJsonFile(filePaths[1]),
        ]);
        const result = compareJson(original, updated);
        if (outputJson) {
            process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        }
        else {
            printHumanResult(result.changes);
        }
        process.exitCode = result.equal ? 0 : 1;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`json-compare: ${message}\n`);
        process.exitCode = 2;
    }
}
async function readJsonFile(filePath) {
    let source;
    try {
        source = await readFile(filePath, "utf8");
    }
    catch (error) {
        throw new Error(`cannot read "${filePath}": ${errorMessage(error)}`);
    }
    try {
        return JSON.parse(source);
    }
    catch (error) {
        throw new Error(`invalid JSON in "${filePath}": ${errorMessage(error)}`);
    }
}
function printHumanResult(changes) {
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
function formatChange(change) {
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
function formatValue(value) {
    return JSON.stringify(value);
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
await main();
//# sourceMappingURL=cli.js.map