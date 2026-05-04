export function isLocalWorldEntryEnabled() {
  return (
    import.meta.env.DEV ||
    import.meta.env.VITE_ENABLE_LOCAL_WORLD_ENTRY === "true"
  );
}
