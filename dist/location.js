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
            return { kind: "value", offset: start };
        }
        this.parsePrimitive();
        return { kind: "value", offset: start };
    }
    parseObject(start) {
        const children = new Map();
        this.offset += 1;
        this.skipWhitespace();
        if (this.source[this.offset] === "}") {
            this.offset += 1;
            return { kind: "object", offset: start, children };
        }
        while (this.offset < this.source.length) {
            const key = this.parseString();
            this.skipWhitespace();
            this.offset += 1;
            const child = this.parseValue();
            children.set(key, child);
            this.skipWhitespace();
            if (this.source[this.offset] === "}") {
                this.offset += 1;
                break;
            }
            this.offset += 1;
            this.skipWhitespace();
        }
        return { kind: "object", offset: start, children };
    }
    parseArray(start) {
        const children = [];
        this.offset += 1;
        this.skipWhitespace();
        if (this.source[this.offset] === "]") {
            this.offset += 1;
            return { kind: "array", offset: start, children };
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
        return { kind: "array", offset: start, children };
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