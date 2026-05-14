// i18n-ignore-start: data / seed / preset content — not user-facing UI.
import {
  CELEBRITY_CHARACTER_PRESETS,
  type CelebrityCharacterPreset,
} from './celebrity-character-presets';
import { COMPANION_CHARACTER_PRESETS } from './companion-character-presets';
import { DATING_AIDE_CHARACTER_PRESETS } from './dating-aide-character-presets';
import { FIXED_WORLD_CHARACTER_PRESETS } from './fixed-world-character-presets';
import { INTELLIGENCE_COUNCIL_CHARACTER_PRESETS } from './intelligence-council-character-presets';
import { INTIMATE_COMPANION_CHARACTER_PRESETS } from './intimate-companion-character-presets';
import { TEACHER_CHARACTER_PRESETS } from './teacher-character-presets';

export const BUILT_IN_CHARACTER_PRESETS: CelebrityCharacterPreset[] = [
  ...FIXED_WORLD_CHARACTER_PRESETS,
  ...TEACHER_CHARACTER_PRESETS,
  ...INTELLIGENCE_COUNCIL_CHARACTER_PRESETS,
  ...CELEBRITY_CHARACTER_PRESETS,
  ...COMPANION_CHARACTER_PRESETS,
  ...INTIMATE_COMPANION_CHARACTER_PRESETS,
  ...DATING_AIDE_CHARACTER_PRESETS,
];

export function listBuiltInCharacterPresets() {
  return BUILT_IN_CHARACTER_PRESETS;
}

export function shouldAutoSeedBuiltInCharacterPreset(
  preset: Pick<CelebrityCharacterPreset, 'autoSeed'>,
) {
  return preset.autoSeed !== false;
}

export function getBuiltInCharacterPreset(presetKey: string) {
  return BUILT_IN_CHARACTER_PRESETS.find(
    (preset) => preset.presetKey === presetKey,
  );
}
// i18n-ignore-end
