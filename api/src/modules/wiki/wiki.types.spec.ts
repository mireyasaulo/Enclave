import { BadRequestException } from '@nestjs/common';
import {
  WIKI_CONTENT_SCHEMA_VERSION,
  WIKI_REJECTED_FIELDS,
  isHighRiskRecipeChange,
  pickWikiContent,
  snapshotFromCharacter,
  snapshotFromRecipe,
  createDefaultWikiRecipe,
} from './wiki.types';

describe('isHighRiskRecipeChange', () => {
  it('marks identity.background as high-risk (legacy core_logic injection)', () => {
    const report = isHighRiskRecipeChange(['identity.background']);
    expect(report.highRisk).toBe(true);
    expect(report.reasons).toContain('identity.background');
  });

  it('marks identity.motivation and identity.worldview as high-risk', () => {
    expect(isHighRiskRecipeChange(['identity.motivation']).highRisk).toBe(true);
    expect(isHighRiskRecipeChange(['identity.worldview']).highRisk).toBe(true);
  });

  it('keeps identity.name / avatar / bio / occupation as low-risk (content channel)', () => {
    const report = isHighRiskRecipeChange([
      'identity.name',
      'identity.avatar',
      'identity.bio',
      'identity.relationship',
      'identity.relationshipType',
      'identity.occupation',
    ]);
    expect(report.highRisk).toBe(false);
    expect(report.reasons).toEqual([]);
  });

  it('marks any prompting / memorySeed / tone / lifeStrategy paths as high-risk', () => {
    expect(
      isHighRiskRecipeChange(['prompting.scenePrompts.chat']).highRisk,
    ).toBe(true);
    expect(isHighRiskRecipeChange(['memorySeed.coreMemory']).highRisk).toBe(
      true,
    );
    expect(isHighRiskRecipeChange(['tone.emotionalTone']).highRisk).toBe(true);
    expect(
      isHighRiskRecipeChange(['lifeStrategy.activityFrequency']).highRisk,
    ).toBe(true);
  });

  it('marks realityLink subpaths as high-risk', () => {
    expect(isHighRiskRecipeChange(['realityLink']).highRisk).toBe(true);
    expect(isHighRiskRecipeChange(['realityLink.source']).highRisk).toBe(true);
  });

  it('returns empty reasons when only low-risk paths changed', () => {
    expect(isHighRiskRecipeChange([]).highRisk).toBe(false);
    expect(
      isHighRiskRecipeChange(['identity.name']).reasons,
    ).toEqual([]);
  });

  it('aggregates multiple high-risk reasons', () => {
    const report = isHighRiskRecipeChange([
      'identity.motivation',
      'prompting.coreLogic',
      'identity.name',
    ]);
    expect(report.highRisk).toBe(true);
    expect(report.reasons).toEqual([
      'identity.motivation',
      'prompting.coreLogic',
    ]);
  });
});

describe('pickWikiContent', () => {
  it('rejects D/E class fields with BadRequestException', () => {
    for (const field of WIKI_REJECTED_FIELDS) {
      expect(() =>
        pickWikiContent({
          name: 'X',
          avatar: 'a',
          bio: 'b',
          relationship: 'r',
          relationshipType: 'rt',
          expertDomains: [],
          [field]: 'leak',
        }),
      ).toThrow(BadRequestException);
    }
  });

  it('passes when only A class fields are present', () => {
    const out = pickWikiContent({
      name: 'X',
      avatar: 'a',
      bio: 'b',
      personality: 'p',
      relationship: 'r',
      relationshipType: 'rt',
      expertDomains: ['d1'],
      triggerScenes: ['s1'],
    });
    expect(out.schemaVersion).toBe(WIKI_CONTENT_SCHEMA_VERSION);
    expect(out.name).toBe('X');
    expect(out.expertDomains).toEqual(['d1']);
    expect(out.triggerScenes).toEqual(['s1']);
  });

  it('treats undefined rejected fields as absent (not present in input)', () => {
    expect(() =>
      pickWikiContent({
        name: 'X',
        avatar: 'a',
        bio: 'b',
        relationship: 'r',
        relationshipType: 'rt',
        expertDomains: [],
        isOnline: undefined,
      }),
    ).not.toThrow();
  });
});

describe('snapshotFromCharacter', () => {
  it('strips D/E fields silently (internal path, not user input)', () => {
    const snap = snapshotFromCharacter({
      id: 'char_1',
      name: 'N',
      avatar: 'a',
      bio: 'b',
      relationship: 'r',
      relationshipType: 'rt',
      expertDomains: [],
      isOnline: true,
      modelRoutingMode: 'override',
      sourceType: 'manual_admin',
    });
    expect(snap.schemaVersion).toBe(WIKI_CONTENT_SCHEMA_VERSION);
    expect(snap.name).toBe('N');
    expect(Object.keys(snap)).not.toContain('isOnline');
    expect(Object.keys(snap)).not.toContain('modelRoutingMode');
  });
});

describe('snapshotFromRecipe', () => {
  it('produces a snapshot with schemaVersion stamped', () => {
    const recipe = createDefaultWikiRecipe({
      name: 'R',
      avatar: 'a',
      bio: 'b',
      relationship: '友',
      relationshipType: 'friend',
    });
    const snap = snapshotFromRecipe(recipe);
    expect(snap.schemaVersion).toBe(WIKI_CONTENT_SCHEMA_VERSION);
    expect(snap.name).toBe('R');
  });
});
