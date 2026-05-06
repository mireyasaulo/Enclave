/**
 * Frontend port of api/src/modules/wiki/wiki.types.ts:diffPaths.
 * Returns dotted paths where left/right differ; both being primitives at
 * a path counts as a single leaf. Used for nested-path diff in history view.
 */
export function diffPaths(
  left: unknown,
  right: unknown,
  prefix = "",
): string[] {
  if (JSON.stringify(left) === JSON.stringify(right)) return [];
  const leftObject =
    typeof left === "object" && left !== null && !Array.isArray(left);
  const rightObject =
    typeof right === "object" && right !== null && !Array.isArray(right);
  if (!leftObject || !rightObject) return [prefix || "root"];
  const keys = new Set([
    ...Object.keys(left as Record<string, unknown>),
    ...Object.keys(right as Record<string, unknown>),
  ]);
  const result: string[] = [];
  for (const key of keys) {
    result.push(
      ...diffPaths(
        (left as Record<string, unknown>)[key],
        (right as Record<string, unknown>)[key],
        prefix ? `${prefix}.${key}` : key,
      ),
    );
  }
  return result;
}

export function getPathValue(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (value && typeof value === "object") {
      return (value as Record<string, unknown>)[segment];
    }
    return undefined;
  }, obj);
}

export type RecipeDiffEntry = {
  path: string;
  before: unknown;
  after: unknown;
};

export function recipeDiffEntries(
  before: unknown,
  after: unknown,
): RecipeDiffEntry[] {
  return diffPaths(before, after).map((path) => ({
    path,
    before: getPathValue(before, path),
    after: getPathValue(after, path),
  }));
}
