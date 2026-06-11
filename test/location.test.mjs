import assert from "node:assert/strict";
import test from "node:test";

import { findJsonLocation, findJsonPath } from "../dist/index.js";

const source = `{
  "user": {
    "name": "Ada",
    "roles": [
      "admin",
      {
        "label": "author"
      }
    ]
  },
  "a/b~c": true
}
`;

test("finds the root and nested object values", () => {
  assert.deepEqual(findJsonLocation(source, []), {
    line: 1,
    column: 1,
  });
  assert.deepEqual(findJsonLocation(source, ["user"]), {
    line: 2,
    column: 11,
  });
  assert.deepEqual(findJsonLocation(source, ["user", "name"]), {
    line: 3,
    column: 13,
  });
});

test("finds array elements using numeric or string indexes", () => {
  assert.deepEqual(findJsonLocation(source, ["user", "roles", 0]), {
    line: 5,
    column: 7,
  });
  assert.deepEqual(
    findJsonLocation(source, ["user", "roles", "1", "label"]),
    {
      line: 7,
      column: 18,
    },
  );
});

test("resolves decoded property names", () => {
  const escapedSource = `{
  "line\\nbreak": {
    "\\u006eame": "Ada"
  }
}`;

  assert.deepEqual(
    findJsonLocation(escapedSource, ["line\nbreak", "name"]),
    {
      line: 3,
      column: 18,
    },
  );
  assert.deepEqual(findJsonLocation(source, ["a/b~c"]), {
    line: 11,
    column: 12,
  });
});

test("returns null for a missing or invalid path", () => {
  assert.equal(findJsonLocation(source, ["missing"]), null);
  assert.equal(findJsonLocation(source, ["user", "roles", -1]), null);
  assert.equal(findJsonLocation(source, ["user", "roles", "01"]), null);
  assert.equal(findJsonLocation(source, ["user", "name", "length"]), null);
});

test("handles CRLF line endings", () => {
  const crlfSource = "{\r\n  \"enabled\": true\r\n}\r\n";

  assert.deepEqual(findJsonLocation(crlfSource, ["enabled"]), {
    line: 2,
    column: 14,
  });
});

test("throws a SyntaxError for invalid JSON", () => {
  assert.throws(
    () => findJsonLocation('{"name": }', ["name"]),
    SyntaxError,
  );
});

test("finds object paths from source offsets", () => {
  assert.deepEqual(findJsonPath(source, source.indexOf('"Ada"') + 2), [
    "user",
    "name",
  ]);
  assert.deepEqual(findJsonPath(source, source.indexOf('"name"') + 2), [
    "user",
    "name",
  ]);
  assert.deepEqual(findJsonPath(source, source.indexOf('"a/b~c"') + 2), [
    "a/b~c",
  ]);

  const escapedSource = '{"line\\nbreak":{"\\u006eame":"Ada"}}';
  assert.deepEqual(findJsonPath(escapedSource, escapedSource.indexOf('"Ada"')), [
    "line\nbreak",
    "name",
  ]);
});

test("finds array paths from source offsets", () => {
  assert.deepEqual(findJsonPath(source, source.indexOf('"admin"') + 2), [
    "user",
    "roles",
    0,
  ]);
  assert.deepEqual(findJsonPath(source, source.indexOf('"author"') + 2), [
    "user",
    "roles",
    1,
    "label",
  ]);
});

test("finds container paths and the root path", () => {
  assert.deepEqual(findJsonPath(source, 0), []);
  assert.deepEqual(findJsonPath(source, source.indexOf('"roles"') + 9), [
    "user",
    "roles",
  ]);
  assert.deepEqual(findJsonPath(source, source.indexOf("{", 2)), ["user"]);
});

test("round trips paths through locations and offsets", () => {
  const paths = [
    [],
    ["user"],
    ["user", "name"],
    ["user", "roles", 0],
    ["user", "roles", 1, "label"],
    ["a/b~c"],
  ];

  for (const path of paths) {
    const location = findJsonLocation(source, path);
    assert.notEqual(location, null);
    assert.deepEqual(findJsonPath(source, location), path);
    assert.deepEqual(
      findJsonPath(source, locationToOffset(source, location)),
      path,
    );
  }
});

test("finds paths from line and column positions", () => {
  assert.deepEqual(findJsonPath(source, { line: 7, column: 20 }), [
    "user",
    "roles",
    1,
    "label",
  ]);

  const crlfSource = "{\r\n  \"enabled\": true\r\n}\r\n";
  assert.deepEqual(findJsonPath(crlfSource, { line: 2, column: 14 }), [
    "enabled",
  ]);
});

test("returns null for invalid line and column positions", () => {
  assert.equal(findJsonPath(source, { line: 0, column: 1 }), null);
  assert.equal(findJsonPath(source, { line: 1, column: 0 }), null);
  assert.equal(findJsonPath(source, { line: 99, column: 1 }), null);
  assert.equal(findJsonPath(source, { line: 1, column: 99 }), null);
  assert.equal(findJsonPath(source, { line: 1.5, column: 1 }), null);
});

test("returns null for offsets outside the JSON value", () => {
  const paddedSource = `  ${source}  `;

  assert.equal(findJsonPath(paddedSource, 0), null);
  assert.equal(findJsonPath(paddedSource, paddedSource.length), null);
  assert.equal(findJsonPath(source, -1), null);
  assert.equal(findJsonPath(source, 1.5), null);
  assert.equal(findJsonPath(source, source.length), null);
  assert.equal(findJsonPath(source, source.length + 1), null);
});

test("findJsonPath throws a SyntaxError for invalid JSON", () => {
  assert.throws(
    () => findJsonPath('{"name": }', 2),
    SyntaxError,
  );
});

function locationToOffset(text, location) {
  const lines = text.split(/\r\n|\r|\n/);
  let offset = 0;

  for (let line = 1; line < location.line; line += 1) {
    offset += lines[line - 1].length;
    offset += text[offset] === "\r" && text[offset + 1] === "\n" ? 2 : 1;
  }

  return offset + location.column - 1;
}
