/**
 * Compares two JSON values and reports differences using RFC 6901 JSON Pointer
 * paths. Arrays are compared by index.
 */
export function compareJson(original, updated) {
    const changes = [];
    compareValues(original, updated, "", changes);
    return {
        equal: changes.length === 0,
        changes,
    };
}
function compareValues(original, updated, path, changes) {
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
function compareArrays(original, updated, path, changes) {
    const sharedLength = Math.min(original.length, updated.length);
    for (let index = 0; index < sharedLength; index += 1) {
        compareValues(original[index], updated[index], appendPath(path, String(index)), changes);
    }
    for (let index = sharedLength; index < original.length; index += 1) {
        changes.push({
            type: "removed",
            path: appendPath(path, String(index)),
            oldValue: original[index],
        });
    }
    for (let index = sharedLength; index < updated.length; index += 1) {
        changes.push({
            type: "added",
            path: appendPath(path, String(index)),
            value: updated[index],
        });
    }
}
function compareObjects(original, updated, path, changes) {
    for (const key of Object.keys(original)) {
        const childPath = appendPath(path, key);
        if (!Object.hasOwn(updated, key)) {
            changes.push({
                type: "removed",
                path: childPath,
                oldValue: original[key],
            });
            continue;
        }
        compareValues(original[key], updated[key], childPath, changes);
    }
    for (const key of Object.keys(updated)) {
        if (!Object.hasOwn(original, key)) {
            changes.push({
                type: "added",
                path: appendPath(path, key),
                value: updated[key],
            });
        }
    }
}
function isJsonObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function appendPath(path, segment) {
    return `${path}/${escapePointerSegment(segment)}`;
}
function escapePointerSegment(segment) {
    return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}
//# sourceMappingURL=compare.js.map