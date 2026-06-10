export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | {
    [key: string]: JsonValue;
};
export interface AddedChange {
    type: "added";
    path: string;
    value: JsonValue;
}
export interface RemovedChange {
    type: "removed";
    path: string;
    oldValue: JsonValue;
}
export interface ChangedChange {
    type: "changed";
    path: string;
    oldValue: JsonValue;
    newValue: JsonValue;
}
export type JsonChange = AddedChange | RemovedChange | ChangedChange;
export interface ComparisonResult {
    equal: boolean;
    changes: JsonChange[];
}
/**
 * Compares two JSON values and reports differences using RFC 6901 JSON Pointer
 * paths. Arrays are compared by index.
 */
export declare function compareJson(original: JsonValue, updated: JsonValue): ComparisonResult;
//# sourceMappingURL=compare.d.ts.map