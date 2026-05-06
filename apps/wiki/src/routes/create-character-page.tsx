import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CharacterBlueprintRecipe } from "@yinjie/contracts";
import {
  AppSection,
  Button,
  Card,
  InlineNotice,
  TextAreaField,
  TextField,
} from "@yinjie/ui";
import { useAuth } from "../lib/use-auth";
import { wikiApi, type WikiContentSnapshot } from "../lib/wiki-api";
import { LogicEditor, mergeContentIntoRecipe } from "./character-page";
import { PageShell } from "../components/page-shell";
import { FormRow } from "../components/form-row";

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function CreateCharacterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [characterId, setCharacterId] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [relationship, setRelationship] = useState("世界角色");
  const [relationshipType, setRelationshipType] = useState("custom");
  const [bio, setBio] = useState("");
  const [personality, setPersonality] = useState("");
  const [expertDomains, setExpertDomains] = useState("general");
  const [triggerScenes, setTriggerScenes] = useState("");
  const [summary, setSummary] = useState("");
  const [recipeText, setRecipeText] = useState("");
  const [recipeDraft, setRecipeDraft] = useState<CharacterBlueprintRecipe>(() =>
    buildDefaultRecipe(),
  );

  const createMut = useMutation({
    mutationFn: () => {
      const contentSnapshot: WikiContentSnapshot = {
        name: name.trim(),
        avatar: avatar.trim(),
        bio: bio.trim(),
        personality: personality.trim(),
        expertDomains: splitList(expertDomains),
        triggerScenes: splitList(triggerScenes),
        relationship: relationship.trim(),
        relationshipType: relationshipType.trim(),
      };
      const recipeSnapshot = recipeText.trim()
        ? (JSON.parse(recipeText) as CharacterBlueprintRecipe)
        : mergeContentIntoRecipe(recipeDraft, contentSnapshot);
      return wikiApi.createPage({
        characterId: characterId.trim() || null,
        contentSnapshot,
        recipeSnapshot,
        editSummary: summary.trim() || "由当前贡献者初始化创建的角色词条",
      });
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["wiki", "characters"] });
      void navigate({
        to: "/character/$characterId",
        params: { characterId: res.characterId },
      });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMut.mutate();
  }

  if (!user) {
    return (
      <PageShell eyebrow="编辑" title="创建世界角色">
        <Card className="p-6 text-sm">请先登录后再创建角色。</Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="编辑"
      title="创建世界角色"
      description="新角色会先进入待创建队列；巡查员通过后才会发布到运行时角色注册表。"
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <AppSection className="space-y-4">
          <h2 className="text-base font-semibold">基础信息</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormRow label="角色 ID" hint="可选；留空由系统生成">
              <TextField
                value={characterId}
                onChange={(event) => setCharacterId(event.target.value)}
                placeholder="例如 night-archivist"
              />
            </FormRow>
            <FormRow label="名称" required>
              <TextField
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </FormRow>
            <FormRow label="头像 URL" className="md:col-span-2">
              <TextField
                value={avatar}
                onChange={(event) => setAvatar(event.target.value)}
              />
            </FormRow>
            <FormRow label="关系描述" required>
              <TextField
                required
                value={relationship}
                onChange={(event) => setRelationship(event.target.value)}
              />
            </FormRow>
            <FormRow label="关系类型" required>
              <TextField
                required
                value={relationshipType}
                onChange={(event) =>
                  setRelationshipType(event.target.value)
                }
              />
            </FormRow>
          </div>
          <FormRow label="角色简介" required>
            <TextAreaField
              required
              rows={4}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />
          </FormRow>
          <FormRow label="性格 / 语气">
            <TextAreaField
              rows={3}
              value={personality}
              onChange={(event) => setPersonality(event.target.value)}
            />
          </FormRow>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormRow label="专长领域" hint="逗号分隔">
              <TextField
                value={expertDomains}
                onChange={(event) => setExpertDomains(event.target.value)}
              />
            </FormRow>
            <FormRow label="触发场景" hint="逗号分隔">
              <TextField
                value={triggerScenes}
                onChange={(event) => setTriggerScenes(event.target.value)}
              />
            </FormRow>
          </div>
          <FormRow
            label="创建摘要"
            required
            hint="≥10 字。说明这个角色为什么值得加入"
          >
            <TextField
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              maxLength={500}
            />
          </FormRow>
        </AppSection>

        <LogicEditor recipe={recipeDraft} onChange={setRecipeDraft} />

        <AppSection className="space-y-3">
          <h2 className="text-base font-semibold">高级：直接贴 recipe JSON（可选）</h2>
          <p className="text-xs text-[color:var(--text-muted)]">
            填写后会忽略上方分节字段，直接用此 JSON 提交。留空则按上方字段生成默认逻辑。
          </p>
          <TextAreaField
            rows={8}
            value={recipeText}
            onChange={(event) => setRecipeText(event.target.value)}
            placeholder="留空则按上方档案字段生成默认角色逻辑"
          />
        </AppSection>

        {createMut.isError && (
          <InlineNotice tone="danger">
            {(createMut.error as Error).message}
          </InlineNotice>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            variant="primary"
            disabled={createMut.isPending || name.trim().length === 0}
          >
            {createMut.isPending ? "提交中..." : "✨ 提交创建"}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}

function buildDefaultRecipe(): CharacterBlueprintRecipe {
  return {
    identity: {
      name: "未命名角色",
      relationship: "世界角色",
      relationshipType: "custom",
      avatar: "",
      bio: "",
      occupation: "",
      background: "",
      motivation: "",
      worldview: "",
    },
    expertise: {
      expertDomains: ["general"],
      expertiseDescription: "",
      knowledgeLimits: "",
      refusalStyle: "",
    },
    tone: {
      speechPatterns: [],
      catchphrases: [],
      topicsOfInterest: [],
      emotionalTone: "grounded",
      responseLength: "medium",
      emojiUsage: "occasional",
      workStyle: "",
      socialStyle: "",
      taboos: [],
      quirks: [],
      coreDirective: "",
      basePrompt: "",
      systemPrompt: "",
    },
    prompting: {
      coreLogic: "",
      scenePrompts: {
        chat: "",
        moments_post: "",
        moments_comment: "",
        feed_post: "",
        channel_post: "",
        feed_comment: "",
        greeting: "",
        proactive: "",
      },
    },
    memorySeed: {
      memorySummary: "",
      coreMemory: "",
      recentSummarySeed: "",
      forgettingCurve: 70,
      recentSummaryPrompt: "",
      coreMemoryPrompt: "",
    },
    reasoning: {
      enableCoT: true,
      enableReflection: true,
      enableRouting: true,
    },
    lifeStrategy: {
      activityFrequency: "normal",
      momentsFrequency: 1,
      feedFrequency: 1,
      activeHoursStart: 8,
      activeHoursEnd: 23,
      triggerScenes: [],
    },
    publishMapping: {
      isTemplate: false,
      onlineModeDefault: "auto",
      activityModeDefault: "auto",
      initialOnline: false,
      initialActivity: "free",
    },
    realityLink: null,
  };
}
