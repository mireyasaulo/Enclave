import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { CharacterBlueprintRecipe } from "@yinjie/contracts";
import { Button } from "@yinjie/ui";
import { wikiApi } from "../lib/wiki-api";

const SCENES: Array<{ key: string; label: string }> = [
  { key: "chat", label: "聊天" },
  { key: "greeting", label: "问候" },
  { key: "proactive", label: "主动触达" },
  { key: "moments_post", label: "朋友圈" },
  { key: "moments_comment", label: "朋友圈评论" },
  { key: "feed_post", label: "广场发帖" },
  { key: "feed_comment", label: "广场评论" },
  { key: "channel_post", label: "视频号" },
];

/**
 * "改前 vs 改后" prompt 预览：调用 /wiki/pages/:id/preview-prompt 用当前
 * 表单中的 recipe 渲染 system_prompt，让编辑者直观看到改动效果。
 *
 * 不写库；只读预览。
 */
export function ScenePromptPreview({
  characterId,
  recipe,
  baselineRecipe,
}: {
  characterId: string;
  recipe: CharacterBlueprintRecipe;
  baselineRecipe?: CharacterBlueprintRecipe | null;
}) {
  const [scene, setScene] = useState<string>("chat");
  const previewMut = useMutation({
    mutationFn: (input: { recipe: CharacterBlueprintRecipe; scene: string }) =>
      wikiApi.previewPrompt(characterId, input.recipe, input.scene),
  });
  const baselineMut = useMutation({
    mutationFn: (input: { recipe: CharacterBlueprintRecipe; scene: string }) =>
      wikiApi.previewPrompt(characterId, input.recipe, input.scene),
  });

  const runBoth = async () => {
    await previewMut.mutateAsync({ recipe, scene });
    if (baselineRecipe) {
      await baselineMut.mutateAsync({ recipe: baselineRecipe, scene });
    }
  };

  return (
    <div className="rounded border border-[var(--border-subtle)] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <strong className="text-sm">Prompt 预览</strong>
        <select
          className="border rounded px-2 py-1 text-xs bg-white"
          value={scene}
          onChange={(e) => setScene(e.target.value)}
        >
          {SCENES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="ghost"
          onClick={runBoth}
          disabled={previewMut.isPending || baselineMut.isPending}
        >
          {previewMut.isPending ? "渲染中..." : "渲染"}
        </Button>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        实时把当前编辑器中的 recipe 渲染成 AI 看到的 system prompt，避免误改。
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {baselineRecipe && (
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">改前（baseline）</div>
            <pre className="bg-[rgba(0,0,0,0.04)] p-2 rounded text-xs whitespace-pre-wrap break-words max-h-72 overflow-auto">
              {baselineMut.data?.prompt ?? "（点击渲染）"}
            </pre>
          </div>
        )}
        <div>
          <div className="text-xs text-[var(--text-muted)] mb-1">改后（当前编辑）</div>
          <pre className="bg-[rgba(0,0,0,0.04)] p-2 rounded text-xs whitespace-pre-wrap break-words max-h-72 overflow-auto">
            {previewMut.data?.prompt ?? "（点击渲染）"}
          </pre>
        </div>
      </div>
      {previewMut.isError && (
        <p className="text-xs text-[var(--state-danger-text)]">
          {(previewMut.error as Error).message}
        </p>
      )}
    </div>
  );
}
