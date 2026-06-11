/**
 * Finds the start of a JSON value identified by an object-property/array-index
 * path. Returns null when the path does not exist.
 *
 * The empty path identifies the root value. Array indexes may be numbers or
 * strings containing a non-negative integer.
 */
export function findJsonLocation(source, path) {
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
            node = node.children[index];
            continue;
        }
        return null;
    }
    return offsetToLocation(source, node.offset);
}
/**
 * Finds the deepest JSON value at a zero-based UTF-16 source offset.
 *
 * Object property names and the whitespace between a property name and its
 * value resolve to that property's path. Returns null when the offset is
 * outside the root JSON value.
 */
export function findJsonPath(source, offset) {
    JSON.parse(source);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > source.length) {
        return null;
    }
    const root = new LocationParser(source).parse();
    if (offset < root.offset || offset >= root.end) {
        return null;
    }
    return pathAtOffset(root, offset, []);
}
class LocationParser {
    source;
    offset = 0;
    constructor(source) {
        this.source = source;
    }
    parse() {
        this.skipWhitespace();
        return this.parseValue();
    }
    parseValue() {
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
    parseObject(start) {
        const children = new Map();
        const properties = [];
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
    parseArray(start) {
        const children = [];
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
    parseString() {
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
        return JSON.parse(this.source.slice(start, this.offset));
    }
    parsePrimitive() {
        while (this.offset < this.source.length) {
            const character = this.source[this.offset];
            if (character === "," ||
                character === "]" ||
                character === "}" ||
                isJsonWhitespace(character)) {
                return;
            }
            this.offset += 1;
        }
    }
    skipWhitespace() {
        while (this.offset < this.source.length &&
            isJsonWhitespace(this.source[this.offset])) {
            this.offset += 1;
        }
    }
}
function pathAtOffset(node, offset, path) {
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
    }
    else if (node.kind === "array") {
        for (let index = 0; index < node.children.length; index += 1) {
            const child = node.children[index];
            if (offset >= child.offset && offset < child.end) {
                return pathAtOffset(child, offset, [...path, index]);
            }
        }
    }
    return path;
}
function parseArrayIndex(segment) {
    if (typeof segment === "number") {
        return Number.isSafeInteger(segment) && segment >= 0 ? segment : null;
    }
    if (!/^(0|[1-9]\d*)$/.test(segment)) {
        return null;
    }
    const index = Number(segment);
    return Number.isSafeInteger(index) ? index : null;
}
function offsetToLocation(source, targetOffset) {
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
        }
        else if (character === "\n") {
            line += 1;
            lineStart = offset + 1;
        }
    }
    return {
        line,
        column: targetOffset - lineStart + 1,
    };
}
function isJsonWhitespace(character) {
    return (character === " " ||
        character === "\t" ||
        character === "\n" ||
        character === "\r");
}
//# sourceMappingURL=location.js.map