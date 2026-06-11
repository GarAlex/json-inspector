export type JsonPathSegment = string | number;

export interface JsonLocation {
  /** One-based line number. */
  line: number;
  /** One-based column number, counted in UTF-16 code units. */
  column: number;
}

interface LocatedValue {
  kind: "value";
  offset: number;
  end: number;
}

interface LocatedArray {
  kind: "array";
  offset: number;
  end: number;
  children: LocatedNode[];
}

interface LocatedProperty {
  key: string;
  offset: number;
  node: LocatedNode;
}

interface LocatedObject {
  kind: "object";
  offset: number;
  end: number;
  children: Map<string, LocatedNode>;
  properties: LocatedProperty[];
}

type LocatedNode = LocatedValue | LocatedArray | LocatedObject;

/**
 * Finds the start of a JSON value identified by an object-property/array-index
 * path. Returns null when the path does not exist.
 *
 * The empty path identifies the root value. Array indexes may be numbers or
 * strings containing a non-negative integer.
 */
export function findJsonLocation(
  source: string,
  path: readonly JsonPathSegment[],
): JsonLocation | null {
  JSON.parse(source);

  const root = new LocationParser(source).parse();
  let node = root;

  for (const segment of path) {
    if (node.kind === "object") {
      const child = node.children.get(String(segment));

      if (child === undefined) {
        return null;
      }

      node = child;
      continue;
    }

    if (node.kind === "array") {
      const index = parseArrayIndex(segment);

      if (index === null || index >= node.children.length) {
        return null;
      }

      node = node.children[index] as LocatedNode;
      continue;
    }

    return null;
  }

  return offsetToLocation(source, node.offset);
}

/**
 * Finds the deepest JSON value at a source position.
 *
 * Object property names and the whitespace between a property name and its
 * value resolve to that property's path. The position may be a zero-based
 * UTF-16 offset or a one-based line and column. Returns null when the position
 * is invalid or outside the root JSON value.
 */
export function findJsonPath(
  source: string,
  position: number | JsonLocation,
): JsonPathSegment[] | null {
  JSON.parse(source);

  const offset = typeof position === "number"
    ? position
    : locationToOffset(source, position);

  if (
    offset === null ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > source.length
  ) {
    return null;
  }

  const root = new LocationParser(source).parse();

  if (offset < root.offset || offset >= root.end) {
    return null;
  }

  return pathAtOffset(root, offset, []);
}

class LocationParser {
  private offset = 0;

  constructor(private readonly source: string) {}

  parse(): LocatedNode {
    this.skipWhitespace();
    return this.parseValue();
  }

  private parseValue(): LocatedNode {
    this.skipWhitespace();
    const start = this.offset;
    const character = this.source[this.offset];

    if (character === "{") {
      return this.parseObject(start);
    }

    if (character === "[") {
      return this.parseArray(start);
    }

    if (character === '"') {
      this.parseString();
      return { kind: "value", offset: start, end: this.offset };
    }

    this.parsePrimitive();
    return { kind: "value", offset: start, end: this.offset };
  }

  private parseObject(start: number): LocatedNode {
    const children = new Map<string, LocatedNode>();
    const properties: LocatedProperty[] = [];
    this.offset += 1;
    this.skipWhitespace();

    if (this.source[this.offset] === "}") {
      this.offset += 1;
      return {
        kind: "object",
        offset: start,
        end: this.offset,
        children,
        properties,
      };
    }

    while (this.offset < this.source.length) {
      const propertyOffset = this.offset;
      const key = this.parseString();
      this.skipWhitespace();
      this.offset += 1;

      const child = this.parseValue();
      children.set(key, child);
      properties.push({ key, offset: propertyOffset, node: child });
      this.skipWhitespace();

      if (this.source[this.offset] === "}") {
        this.offset += 1;
        break;
      }

      this.offset += 1;
      this.skipWhitespace();
    }

    return {
      kind: "object",
      offset: start,
      end: this.offset,
      children,
      properties,
    };
  }

  private parseArray(start: number): LocatedNode {
    const children: LocatedNode[] = [];
    this.offset += 1;
    this.skipWhitespace();

    if (this.source[this.offset] === "]") {
      this.offset += 1;
      return { kind: "array", offset: start, end: this.offset, children };
    }

    while (this.offset < this.source.length) {
      children.push(this.parseValue());
      this.skipWhitespace();

      if (this.source[this.offset] === "]") {
        this.offset += 1;
        break;
      }

      this.offset += 1;
      this.skipWhitespace();
    }

    return { kind: "array", offset: start, end: this.offset, children };
  }

  private parseString(): string {
    const start = this.offset;
    this.offset += 1;

    while (this.offset < this.source.length) {
      const character = this.source[this.offset];

      if (character === "\\") {
        this.offset += 2;
        continue;
      }

      this.offset += 1;

      if (character === '"') {
        break;
      }
    }

    return JSON.parse(this.source.slice(start, this.offset)) as string;
  }

  private parsePrimitive(): void {
    while (this.offset < this.source.length) {
      const character = this.source[this.offset] as string;

      if (
        character === "," ||
        character === "]" ||
        character === "}" ||
        isJsonWhitespace(character)
      ) {
        return;
      }

      this.offset += 1;
    }
  }

  private skipWhitespace(): void {
    while (
      this.offset < this.source.length &&
      isJsonWhitespace(this.source[this.offset] as string)
    ) {
      this.offset += 1;
    }
  }
}

function pathAtOffset(
  node: LocatedNode,
  offset: number,
  path: JsonPathSegment[],
): JsonPathSegment[] {
  if (node.kind === "object") {
    for (const property of node.properties) {
      if (offset < property.offset || offset >= property.node.end) {
        continue;
      }

      const propertyPath = [...path, property.key];
      return offset >= property.node.offset
        ? pathAtOffset(property.node, offset, propertyPath)
        : propertyPath;
    }
  } else if (node.kind === "array") {
    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index] as LocatedNode;

      if (offset >= child.offset && offset < child.end) {
        return pathAtOffset(child, offset, [...path, index]);
      }
    }
  }

  return path;
}

function parseArrayIndex(segment: JsonPathSegment): number | null {
  if (typeof segment === "number") {
    return Number.isSafeInteger(segment) && segment >= 0 ? segment : null;
  }

  if (!/^(0|[1-9]\d*)$/.test(segment)) {
    return null;
  }

  const index = Number(segment);
  return Number.isSafeInteger(index) ? index : null;
}

function offsetToLocation(source: string, targetOffset: number): JsonLocation {
  let line = 1;
  let lineStart = 0;

  for (let offset = 0; offset < targetOffset; offset += 1) {
    const character = source[offset];

    if (character === "\r") {
      if (source[offset + 1] === "\n") {
        offset += 1;
      }

      line += 1;
      lineStart = offset + 1;
    } else if (character === "\n") {
      line += 1;
      lineStart = offset + 1;
    }
  }

  return {
    line,
    column: targetOffset - lineStart + 1,
  };
}

function locationToOffset(
  source: string,
  location: JsonLocation,
): number | null {
  if (
    !Number.isSafeInteger(location.line) ||
    !Number.isSafeInteger(location.column) ||
    location.line < 1 ||
    location.column < 1
  ) {
    return null;
  }

  let line = 1;
  let lineStart = 0;

  for (let offset = 0; offset < source.length && line < location.line; offset += 1) {
    const character = source[offset];

    if (character === "\r") {
      if (source[offset + 1] === "\n") {
        offset += 1;
      }

      line += 1;
      lineStart = offset + 1;
    } else if (character === "\n") {
      line += 1;
      lineStart = offset + 1;
    }
  }

  if (line !== location.line) {
    return null;
  }

  let lineEnd = lineStart;
  while (
    lineEnd < source.length &&
    source[lineEnd] !== "\r" &&
    source[lineEnd] !== "\n"
  ) {
    lineEnd += 1;
  }

  const offset = lineStart + location.column - 1;
  return offset <= lineEnd ? offset : null;
}

function isJsonWhitespace(character: string): boolean {
  return (
    character === " " ||
    character === "\t" ||
    character === "\n" ||
    character === "\r"
  );
}
