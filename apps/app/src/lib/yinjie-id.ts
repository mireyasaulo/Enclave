const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function hashCharacterId(characterId: string): string {
  let hash = FNV_OFFSET;
  for (let i = 0; i < characterId.length; i++) {
    hash ^= characterId.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function buildYinjieId(characterId: string): string {
  return `yinjie_${hashCharacterId(characterId)}`;
}
