import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, ErrorBlock, InlineNotice, LoadingBlock } from "@yinjie/ui";
import { cloudAdminApi } from "../lib/cloud-admin-api";
import { useCloudConsoleText } from "../lib/cloud-console-i18n";

export function CloudConfigsPage() {
  const t = useCloudConsoleText();
  const queryClient = useQueryClient();
  const configsQuery = useQuery({
    queryKey: ["cloud-console", "cloud-configs"],
    queryFn: () => cloudAdminApi.listCloudConfigs(),
  });
  const [selectedKey, setSelectedKey] = useState("");
  const [draftKey, setDraftKey] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftValue, setDraftValue] = useState("null");
  const [parseError, setParseError] = useState("");

  useEffect(() => {
    if (!configsQuery.data?.length) {
      return;
    }

    const activeConfig =
      configsQuery.data.find((config) => config.key === selectedKey) ??
      configsQuery.data[0];
    setSelectedKey(activeConfig.key);
    setDraftKey(activeConfig.key);
    setDraftDescription(activeConfig.description || "");
    setDraftValue(JSON.stringify(activeConfig.value, null, 2));
  }, [configsQuery.data, selectedKey]);

  const saveMutation = useMutation({
    mutationFn: () => {
      setParseError("");
      let parsedValue: unknown;
      try {
        parsedValue = JSON.parse(draftValue);
      } catch (error) {
        setParseError(
          error instanceof Error ? error.message : t("Invalid JSON value."),
        );
        throw error;
      }

      return cloudAdminApi.upsertCloudConfig({
        key: draftKey,
        value: parsedValue,
        description: draftDescription || null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["cloud-console", "cloud-configs"],
      });
    },
  });

  if (configsQuery.isLoading) {
    return <LoadingBlock label={t("Loading cloud configs...")} />;
  }

  if (configsQuery.isError) {
    return (
      <ErrorBlock
        message={
          configsQuery.error instanceof Error
            ? configsQuery.error.message
            : t("Failed to load cloud configs.")
        }
      />
    );
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-white p-5 shadow-[var(--shadow-section)]">
        <div className="text-sm font-semibold text-[color:var(--text-primary)]">
          {t("Config keys")}
        </div>
        <div className="mt-3 space-y-3">
          {configsQuery.data?.map((config) => (
            <button
              key={config.key}
              type="button"
              onClick={() => setSelectedKey(config.key)}
              className={`w-full rounded-[20px] border px-4 py-3 text-left ${
                selectedKey === config.key
                  ? "border-[color:var(--border-brand)] bg-[color:var(--brand-soft)]"
                  : "border-[color:var(--border-faint)] bg-[#fafafa]"
              }`}
            >
              <div className="font-medium text-[color:var(--text-primary)]">
                {config.key}
              </div>
              <div className="mt-1 text-sm text-[color:var(--text-secondary)]">
                {config.description || t("No description")}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-white p-5 shadow-[var(--shadow-section)]">
        <div className="grid gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[color:var(--text-secondary)]">
              {t("Config key")}
            </span>
            <input
              value={draftKey}
              onChange={(event) => setDraftKey(event.target.value)}
              placeholder="app.publicBaseUrl"
              className="w-full rounded-2xl border border-[color:var(--border-subtle)] px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[color:var(--text-secondary)]">
              {t("Description")}
            </span>
            <input
              value={draftDescription}
              onChange={(event) => setDraftDescription(event.target.value)}
              placeholder={t("Internal note shown next to the key.")}
              className="w-full rounded-2xl border border-[color:var(--border-subtle)] px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[color:var(--text-secondary)]">
              {t("Value (JSON)")}
            </span>
            <textarea
              value={draftValue}
              onChange={(event) => setDraftValue(event.target.value)}
              className="min-h-64 w-full rounded-2xl border border-[color:var(--border-subtle)] px-3 py-2 font-mono text-sm"
            />
          </label>
        </div>
        <div className="mt-4 flex gap-3">
          <Button
            variant="primary"
            className="rounded-2xl bg-[color:var(--brand-primary)] text-white"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {t("Save config")}
          </Button>
          <Button
            variant="secondary"
            className="rounded-2xl"
            onClick={() => {
              setSelectedKey("");
              setDraftKey("");
              setDraftDescription("");
              setDraftValue("null");
            }}
          >
            {t("New config")}
          </Button>
        </div>
        {parseError ? (
          <InlineNotice className="mt-4" tone="danger">
            {parseError}
          </InlineNotice>
        ) : null}
        {saveMutation.isSuccess ? (
          <InlineNotice className="mt-4" tone="success">
            {t("Cloud config saved.")}
          </InlineNotice>
        ) : null}
      </div>
    </section>
  );
}
