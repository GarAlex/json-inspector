import assert from "node:assert/strict";
import test from "node:test";

import { findJsonLocation } from "../dist/index.js";

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
