export type JsonPathSegment = string | number;
export interface JsonLocation {
    /** One-based line number. */
    line: number;
    /** One-based column number, counted in UTF-16 code units. */
    column: number;
}
/**
 * Finds the start of a JSON value identified by an object-property/array-index
 * path. Returns null when the path does not exist.
 *
 * The empty path identifies the root value. Array indexes may be numbers or
 * strings containing a non-negative integer.
 */
export declare function findJsonLocation(source: string, path: readonly JsonPathSegment[]): JsonLocation | null;
/**
 * Finds the deepest JSON value at a zero-based UTF-16 source offset.
 *
 * Object property names and the whitespace between a property name and its
 * value resolve to that property's path. Returns null when the offset is
 * outside the root JSON value.
 */
export declare function findJsonPath(source: string, offset: number): JsonPathSegment[] | null;
//# sourceMappingURL=location.d.ts.map