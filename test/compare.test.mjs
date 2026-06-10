import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { compareJson } from "../dist/index.js";

test("reports deeply equal documents", () => {
  const document = {
    name: "Ada",
    active: true,
    metadata: null,
    roles: ["admin", "author"],
  };

  assert.deepEqual(compareJson(document, structuredClone(document)), {
    equal: true,
    changes: [],
  });
});

test("reports nested changed, removed, and added properties", () => {
  const original = {
    user: {
      name: "Ada",
      active: true,
      obsolete: "remove me",
    },
  };
  const updated = {
    user: {
      name: "Grace",
      active: true,
      createdAt: "2026-06-06",
    },
  };

  assert.deepEqual(compareJson(original, updated), {
    equal: false,
    changes: [
      {
        type: "changed",
        path: "/user/name",
        oldValue: "Ada",
        newValue: "Grace",
      },
      {
        type: "removed",
        path: "/user/obsolete",
        oldValue: "remove me",
      },
      {
        type: "added",
        path: "/user/createdAt",
        value: "2026-06-06",
      },
    ],
  });
});

test("compares arrays by index", () => {
  assert.deepEqual(compareJson(["a", "b"], ["a", "c", "d"]), {
    equal: false,
    changes: [
      {
        type: "changed",
        path: "/1",
        oldValue: "b",
        newValue: "c",
      },
      {
        type: "added",
        path: "/2",
        value: "d",
      },
    ],
  });
});

test("escapes JSON Pointer path segments", () => {
  assert.deepEqual(compareJson({ "a/b~c": 1 }, { "a/b~c": 2 }), {
    equal: false,
    changes: [
      {
        type: "changed",
        path: "/a~1b~0c",
        oldValue: 1,
        newValue: 2,
      },
    ],
  });
});

test("reports a root-level type change", () => {
  assert.deepEqual(compareJson({ enabled: true }, null), {
    equal: false,
    changes: [
      {
        type: "changed",
        path: "",
        oldValue: { enabled: true },
        newValue: null,
      },
    ],
  });
});

test("CLI emits JSON and uses exit code 1 for differences", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "json-compare-"));

  try {
    const originalPath = path.join(directory, "original.json");
    const updatedPath = path.join(directory, "updated.json");

    await Promise.all([
      writeFile(originalPath, '{"count":1}\n'),
      writeFile(updatedPath, '{"count":2}\n'),
    ]);

    const result = spawnSync(
      process.execPath,
      ["dist/cli.js", "--json", originalPath, updatedPath],
      {
        cwd: path.resolve(import.meta.dirname, ".."),
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 1);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), {
      equal: false,
      changes: [
        {
          type: "changed",
          path: "/count",
          oldValue: 1,
          newValue: 2,
        },
      ],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
