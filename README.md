# JSON Inspector

A dependency-free runtime TypeScript library for comparing JSON values and
finding value locations in formatted JSON text.

## Install

```bash
npm install json-compass
```

## Compare JSON

```ts
import { compareJson } from "json-compass";

const result = compareJson(
  { user: { name: "Ada", active: true } },
  { user: { name: "Grace", active: true } },
);
```

Result:

```json
{
  "equal": false,
  "changes": [
    {
      "type": "changed",
      "path": "/user/name",
      "oldValue": "Ada",
      "newValue": "Grace"
    }
  ]
}
```

Changes use RFC 6901 JSON Pointer paths and report added, removed, and changed
values. Arrays are compared by index.

## Command Line

```bash
npx json-compass original.json updated.json
npx json-compass --json original.json updated.json
```

When installed globally, the command is available as `json-compare`:

```bash
npm install --global json-compass
json-compare original.json updated.json
```

Exit codes:

- `0`: Documents are equal.
- `1`: Differences were found.
- `2`: Invalid arguments, unreadable files, or invalid JSON.

## Find A Value Location

```ts
import { findJsonLocation } from "json-compass";

const source = `{
  "users": [
    {
      "name": "Ada"
    }
  ]
}`;

findJsonLocation(source, ["users", 0, "name"]);
// { line: 4, column: 15 }
```

Line and column numbers are 1-based and point to the start of the matched JSON
value. Array indexes may be numbers or numeric strings. A missing path returns
`null`, and invalid JSON throws a `SyntaxError`.

## Development

```bash
npm install
npm test
npm run check
```
