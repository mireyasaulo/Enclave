export function searchStringToObject(
  searchString: string | undefined,
): Record<string, string> | undefined {
  if (!searchString) return undefined;
  const cleaned = searchString.startsWith("?")
    ? searchString.slice(1)
    : searchString;
  if (!cleaned) return undefined;
  const params = new URLSearchParams(cleaned);
  const obj: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    obj[key] = value;
  }
  return Object.keys(obj).length ? obj : undefined;
}
