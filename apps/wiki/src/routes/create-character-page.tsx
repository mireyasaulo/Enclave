import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CharacterBlueprintRecipe } from "@yinjie/contracts";
import { Button, Card, ErrorBlock, TextAreaField, TextField } from "@yinjie/ui";
import { useAuth } from "../lib/use-auth";
import { wikiApi, type WikiContentSnapshot } from "../lib/wiki-api";
import { LogicEditor, mergeContentIntoRecipe } from "./character-page";

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
      <Card className="p-6">
        <p>请先登录后再创建角色。</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-5">
      <header>
        <h1 className="text-xl font-semibold">创建世界角色</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          新角色会先进入待创建队列；巡查员通过后才会发布到运行时角色注册表。
        </p>
      </header>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormRow label="角色 ID（可选）">
          <TextField
            value={characterId}
            onChange={(event) => setCharacterId(event.target.value)}
            placeholder="例如 night-archivist"
          />
        </FormRow>
        <FormRow label="名称">
          <TextField
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormRow>
        <FormRow label="头像 URL">
          <TextField
            value={avatar}
            onChange={(event) => setAvatar(event.target.value)}
          />
        </FormRow>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormRow label="关系描述">
            <TextField
              required
              value={relationship}
              onChange={(event) => setRelationship(event.target.value)}
            />
          </FormRow>
          <FormRow label="关系类型">
            <TextField
              required
              value={relationshipType}
              onChange={(event) => setRelationshipType(event.target.value)}
            />
          </FormRow>
        </div>
        <FormRow label="角色简介">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormRow label="专长领域（逗号分隔）">
            <TextField
              value={expertDomains}
              onChange={(event) => setExpertDomains(event.target.value)}
            />
          </FormRow>
          <FormRow label="触发场景（逗号分隔）">
            <TextField
              value={triggerScenes}
              onChange={(event) => setTriggerScenes(event.target.value)}
            />
          </FormRow>
        </div>
        <FormRow
          label="创建摘要"
          hint="≥10 字（必填）。说明这个角色为什么值得加入"
        >
          <TextField
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            maxLength={500}
          />
        </FormRow>
        <div className="rounded border border-[var(--border-subtle)] p-4 space-y-3">
          <div>
            <h2 className="text-base font-semibold">角色逻辑</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              创建申请会携带完整角色逻辑；巡查员审核通过后才会写入运行时角色注册表。
            </p>
          </div>
          <LogicEditor recipe={recipeDraft} onChange={setRecipeDraft} />
        </div>
        <FormRow label="高级：完整角色逻辑 recipe JSON 覆盖（可选）">
          <TextAreaField
            rows={8}
            value={recipeText}
            onChange={(event) => setRecipeText(event.target.value)}
            placeholder="留空则按上方档案字段生成默认角色逻辑"
          />
        </FormRow>
        {createMut.isError && (
          <ErrorBlock message={(createMut.error as Error).message} />
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={createMut.isPending || name.trim().length === 0}
        >
          {createMut.isPending ? "提交中..." : "提交创建"}
        </Button>
      </form>
    </Card>
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

function FormRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm mb-1 block">
        {label}
        {hint && (
          <span className="ml-2 text-xs text-[var(--text-muted)] font-normal">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
