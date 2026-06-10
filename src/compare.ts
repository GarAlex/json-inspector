export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

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

type JsonObject = { [key: string]: JsonValue };

/**
 * Compares two JSON values and reports differences using RFC 6901 JSON Pointer
 * paths. Arrays are compared by index.
 */
export function compareJson(
  original: JsonValue,
  updated: JsonValue,
): ComparisonResult {
  const changes: JsonChange[] = [];

  compareValues(original, updated, "", changes);

  return {
    equal: changes.length === 0,
    changes,
  };
}

function compareValues(
  original: JsonValue,
  updated: JsonValue,
  path: string,
  changes: JsonChange[],
): void {
  if (Object.is(original, updated)) {
    return;
  }

  if (Array.isArray(original) && Array.isArray(updated)) {
    compareArrays(original, updated, path, changes);
    return;
  }

  if (isJsonObject(original) && isJsonObject(updated)) {
    compareObjects(original, updated, path, changes);
    return;
  }

  changes.push({
    type: "changed",
    path,
    oldValue: original,
    newValue: updated,
  });
}

function compareArrays(
  original: JsonValue[],
  updated: JsonValue[],
  path: string,
  changes: JsonChange[],
): void {
  const sharedLength = Math.min(original.length, updated.length);

  for (let index = 0; index < sharedLength; index += 1) {
    compareValues(
      original[index] as JsonValue,
      updated[index] as JsonValue,
      appendPath(path, String(index)),
      changes,
    );
  }

  for (let index = sharedLength; index < original.length; index += 1) {
    changes.push({
      type: "removed",
      path: appendPath(path, String(index)),
      oldValue: original[index] as JsonValue,
    });
  }

  for (let index = sharedLength; index < updated.length; index += 1) {
    changes.push({
      type: "added",
      path: appendPath(path, String(index)),
      value: updated[index] as JsonValue,
    });
  }
}

function compareObjects(
  original: JsonObject,
  updated: JsonObject,
  path: string,
  changes: JsonChange[],
): void {
  for (const key of Object.keys(original)) {
    const childPath = appendPath(path, key);

    if (!Object.hasOwn(updated, key)) {
      changes.push({
        type: "removed",
        path: childPath,
        oldValue: original[key] as JsonValue,
      });
      continue;
    }

    compareValues(
      original[key] as JsonValue,
      updated[key] as JsonValue,
      childPath,
      changes,
    );
  }

  for (const key of Object.keys(updated)) {
    if (!Object.hasOwn(original, key)) {
      changes.push({
        type: "added",
        path: appendPath(path, key),
        value: updated[key] as JsonValue,
      });
    }
  }
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function appendPath(path: string, segment: string): string {
  return `${path}/${escapePointerSegment(segment)}`;
}

function escapePointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}
