import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CharacterBlueprintRecipe } from "@yinjie/contracts";
import { Button, Card, ErrorBlock, TextAreaField, TextField } from "@yinjie/ui";
import { useAuth } from "../lib/use-auth";
import { wikiApi, type WikiContentSnapshot } from "../lib/wiki-api";

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
        : null;
      return wikiApi.createPage({
        characterId: characterId.trim() || null,
        contentSnapshot,
        recipeSnapshot,
        editSummary: summary.trim() || "创建角色词条",
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
        <FormRow label="创建摘要">
          <TextField
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            maxLength={500}
          />
        </FormRow>
        <FormRow label="完整角色逻辑 recipe JSON（可选）">
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

function FormRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm mb-1 block">{label}</span>
      {children}
    </label>
  );
}
