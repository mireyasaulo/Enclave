import { useEffect, useState, type ReactNode } from "react";
import { msg } from "@lingui/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Check } from "lucide-react";
import {
  clearWorldOwnerApiKey,
  getWorldOwner,
  setWorldOwnerApiKey,
  updateWorldOwner,
} from "@yinjie/contracts";
import { LanguageSwitcher, useRuntimeTranslator } from "@yinjie/i18n";
import {
  AppPage,
  Button,
  ErrorBlock,
  InlineNotice,
  LoadingBlock,
  TextAreaField,
  TextField,
  cn,
} from "@yinjie/ui";
import { TabPageTopBar } from "../components/tab-page-top-bar";
import { DesktopUtilityShell } from "../features/shell/desktop-utility-shell";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";
import {
  clearCloudRuntimeSession,
  shouldShowCloudAccountControls,
} from "../lib/cloud-session";
import { useAppRuntimeConfig } from "../runtime/runtime-config-store";
import { useCloudSessionStore } from "../store/cloud-session-store";
import {
  type ChatSendShortcut,
  useChatPreferencesStore,
} from "../store/chat-preferences-store";
import { useWorldOwnerStore } from "../store/world-owner-store";

type SettingsTab = "profile" | "chat" | "ai" | "language" | "legal" | "account";
type LegalTab = "privacy" | "terms" | "community";
type ProfileSettingsMessage = ReturnType<typeof msg>;

const settingsTabs: Array<{ id: SettingsTab; label: ProfileSettingsMessage }> =
  [
    { id: "profile", label: msg`个人资料` },
    { id: "chat", label: msg`聊天` },
    { id: "ai", label: msg`AI 设置` },
    { id: "language", label: msg`语言` },
    { id: "legal", label: msg`协议与规范` },
  ];

const desktopAccountTab = {
  id: "account",
  label: msg`账号与退出`,
} satisfies { id: SettingsTab; label: ProfileSettingsMessage };

const legalTabs: Array<{ id: LegalTab; label: ProfileSettingsMessage }> = [
  { id: "privacy", label: msg`隐私政策` },
  { id: "terms", label: msg`用户协议` },
  { id: "community", label: msg`社区规范` },
];

const chatSendShortcutOptions: Array<{
  id: ChatSendShortcut;
  label: ProfileSettingsMessage;
  description: ProfileSettingsMessage;
}> = [
  {
    id: "enter",
    label: msg`Enter 发送消息`,
    description: msg`按回车直接发送，保持当前更顺手的输入节奏。`,
  },
  {
    id: "mod_enter",
    label: msg`Ctrl/Cmd + Enter 发送消息`,
    description: msg`发送前多一道组合键确认，更接近微信桌面版可切换方式。`,
  },
];

export function ProfileSettingsPage() {
  const t = useRuntimeTranslator();
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isDesktopLayout = useDesktopLayout();
  const runtimeConfig = useAppRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl;
  const ownerId = useWorldOwnerStore((state) => state.id);
  const username = useWorldOwnerStore((state) => state.username);
  const signature = useWorldOwnerStore((state) => state.signature);
  const cloudAccessToken = useCloudSessionStore((state) => state.accessToken);
  const cloudPhone = useCloudSessionStore((state) => state.phone);
  const updateOwnerStore = useWorldOwnerStore((state) => state.updateOwner);
  const hydrateOwner = useWorldOwnerStore((state) => state.hydrateOwner);
  const sendMessageShortcut = useChatPreferencesStore(
    (state) => state.sendMessageShortcut,
  );
  const setSendMessageShortcut = useChatPreferencesStore(
    (state) => state.setSendMessageShortcut,
  );

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [activeLegalTab, setActiveLegalTab] = useState<LegalTab>("privacy");

  const [draftName, setDraftName] = useState(username ?? "");
  const [draftSignature, setDraftSignature] = useState(signature);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [apiBaseDraft, setApiBaseDraft] = useState("");

  const showCloudAccountEntries = shouldShowCloudAccountControls({
    worldAccessMode: runtimeConfig.worldAccessMode,
    runtimeApiBaseUrl: runtimeConfig.apiBaseUrl,
    runtimeCloudPhone: runtimeConfig.cloudPhone,
    accessToken: cloudAccessToken,
    sessionPhone: cloudPhone,
    worldOwnerId: ownerId,
  });

  useEffect(() => {
    setDraftName(username ?? "");
  }, [username]);

  useEffect(() => {
    setDraftSignature(signature);
  }, [signature]);

  const ownerQuery = useQuery({
    queryKey: ["world-owner", baseUrl],
    queryFn: () => getWorldOwner(baseUrl),
  });

  useEffect(() => {
    if (!ownerQuery.data) {
      return;
    }

    hydrateOwner(ownerQuery.data);
    setApiBaseDraft(ownerQuery.data.customApiBase ?? "");
  }, [hydrateOwner, ownerQuery.data]);

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      const owner = await updateWorldOwner(
        {
          username: draftName.trim(),
          signature: draftSignature.trim(),
        },
        baseUrl,
      );
      hydrateOwner(owner);
      updateOwnerStore({
        username: owner.username,
        signature: owner.signature,
      });
    },
  });

  const saveApiKeyMutation = useMutation({
    mutationFn: async () => {
      const owner = await setWorldOwnerApiKey(
        {
          apiKey: apiKeyDraft.trim(),
          apiBase: apiBaseDraft.trim() || undefined,
        },
        baseUrl,
      );
      hydrateOwner(owner);
    },
    onSuccess: () => {
      setApiKeyDraft("");
    },
  });

  const clearApiKeyMutation = useMutation({
    mutationFn: async () => {
      const owner = await clearWorldOwnerApiKey(baseUrl);
      hydrateOwner(owner);
      setApiKeyDraft("");
      setApiBaseDraft(owner.customApiBase ?? "");
    },
  });

  const canSaveProfile = draftName.trim().length > 0;
  const aiSettingsBusy =
    saveApiKeyMutation.isPending || clearApiKeyMutation.isPending;
  const desktopSettingsPath = "/desktop/settings";
  const desktopMode = isDesktopLayout;
  const desktopSettingsRoute = pathname.startsWith("/desktop/settings");
  const desktopPathMismatch = desktopMode && pathname === "/profile/settings";
  const backTo = desktopMode ? "/tabs/chat" : "/tabs/profile";
  const desktopBackTo = desktopSettingsRoute ? "/tabs/chat" : "/tabs/profile";
  const desktopBackLabel = desktopSettingsRoute
    ? t(msg`返回消息`)
    : t(msg`返回资料`);
  const mobileBackLabel =
    backTo === "/tabs/profile" ? t(msg`返回资料页`) : t(msg`返回消息`);

  useEffect(() => {
    if (!desktopPathMismatch) {
      return;
    }

    void navigate({
      to: desktopSettingsPath,
      replace: true,
    });
  }, [desktopPathMismatch, desktopSettingsPath, navigate]);

  function handleMobileBack() {
    void navigate({ to: backTo });
  }

  function handleCloudLogout() {
    clearCloudRuntimeSession();
    void navigate({ to: "/welcome", replace: true });
  }

  function handleRetryOwnerLoad() {
    void ownerQuery.refetch();
  }

  const content = (
    <>
      {desktopMode ? null : (
        <div className="overflow-hidden border-y border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)] px-4 py-1.5">
          <div className="flex gap-1 rounded-[11px] bg-[#f5f5f5] p-[3px]">
            {settingsTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 rounded-[9px] py-1.25 text-[11px] font-medium transition-all duration-[var(--motion-fast)]",
                  activeTab === tab.id
                    ? "bg-white text-[color:var(--text-primary)] shadow-sm"
                    : "text-[color:var(--text-muted)] hover:bg-white/70",
                )}
              >
                {t(tab.label)}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === "profile" ? (
        <MobileSettingsSection
          desktop={desktopMode}
          title={desktopMode ? t(msg`个人资料`) : undefined}
          description={
            desktopMode
              ? t(msg`这里的名称和签名会用于移动端资料页和世界主人展示。`)
              : undefined
          }
        >
          <div className="space-y-3">
            <MobileFieldGroup label={t(msg`显示名称`)}>
              <TextField
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder={t(msg`输入显示名称`)}
                className="rounded-[11px] border-[color:var(--border-faint)] px-3.5 py-2.5 text-[13px] shadow-none focus:translate-y-0"
              />
            </MobileFieldGroup>
            <MobileFieldGroup label={t(msg`签名`)}>
              <TextAreaField
                value={draftSignature}
                onChange={(event) => setDraftSignature(event.target.value)}
                className="min-h-[5.5rem] resize-none rounded-[11px] border-[color:var(--border-faint)] px-3.5 py-2.5 text-[13px] leading-[1.35rem] shadow-none focus:translate-y-0"
                placeholder={t(msg`介绍一下你自己，或者写一句当前状态`)}
              />
            </MobileFieldGroup>
          </div>

          <div className="pt-1">
            <Button
              onClick={() => saveProfileMutation.mutate()}
              disabled={!canSaveProfile || saveProfileMutation.isPending}
              variant="primary"
              className={cn(
                "h-9 w-full rounded-[10px] text-[12px] text-white shadow-none",
                desktopMode
                  ? "bg-[color:var(--brand-primary)] hover:opacity-95"
                  : "bg-[#07c160] hover:bg-[#06ad56]",
              )}
            >
              {saveProfileMutation.isPending
                ? t(msg`保存中...`)
                : t(msg`保存资料`)}
            </Button>
          </div>
          {saveProfileMutation.isError &&
          saveProfileMutation.error instanceof Error ? (
            desktopMode ? (
              <ErrorBlock message={saveProfileMutation.error.message} />
            ) : (
              <MobileSettingsInlineNotice
                tone="danger"
                action={
                  <button
                    type="button"
                    onClick={handleMobileBack}
                    className="shrink-0 rounded-full border border-[rgba(220,38,38,0.14)] bg-white px-2 py-0.5 text-[10px] font-medium text-[color:var(--state-danger-text)]"
                  >
                    {mobileBackLabel}
                  </button>
                }
              >
                {saveProfileMutation.error.message}
              </MobileSettingsInlineNotice>
            )
          ) : null}
          {saveProfileMutation.isSuccess ? (
            desktopMode ? (
              <InlineNotice tone="success">{t(msg`资料已更新。`)}</InlineNotice>
            ) : (
              <MobileSettingsInlineNotice tone="success">
                {t(msg`资料已更新。`)}
              </MobileSettingsInlineNotice>
            )
          ) : null}
        </MobileSettingsSection>
      ) : null}

      {activeTab === "chat" ? (
        <MobileSettingsSection
          desktop={desktopMode}
          title={desktopMode ? t(msg`聊天设置`) : undefined}
          description={
            desktopMode
              ? t(msg`调整桌面和 Web 键盘聊天输入时的发送快捷键。`)
              : t(msg`设置键盘聊天输入时的发送快捷键`)
          }
        >
          <div
            className={cn(
              "overflow-hidden rounded-[14px] border",
              desktopMode
                ? "border-[color:var(--border-faint)] bg-[color:var(--surface-console)]"
                : "border-[color:var(--border-faint)] bg-white",
            )}
          >
            {chatSendShortcutOptions.map((option, index) => {
              const selected = sendMessageShortcut === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSendMessageShortcut(option.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2 text-left transition",
                    index > 0 && "border-t border-[color:var(--border-faint)]",
                    selected
                      ? desktopMode
                        ? "bg-[rgba(7,193,96,0.07)]"
                        : "bg-[rgba(7,193,96,0.08)]"
                      : "hover:bg-[color:var(--surface-card-hover)]",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-[color:var(--text-primary)]">
                      {t(option.label)}
                    </div>
                    <div className="mt-0.5 text-[10px] leading-4 text-[color:var(--text-muted)]">
                      {t(option.description)}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
                      selected
                        ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)] text-white"
                        : "border-[color:var(--border-faint)] bg-white text-transparent",
                    )}
                    aria-hidden="true"
                  >
                    <Check size={12} strokeWidth={2.5} />
                  </span>
                </button>
              );
            })}
          </div>

          {desktopMode ? (
            <InlineNotice tone="muted">
              {t(
                msg`当前仅影响桌面和 Web 的键盘聊天输入，移动端仍以发送按钮和语音入口为主。`,
              )}
            </InlineNotice>
          ) : (
            <MobileSettingsInlineNotice tone="muted">
              {t(
                msg`当前仅影响桌面和 Web 的键盘聊天输入，移动端仍以发送按钮和语音入口为主。`,
              )}
            </MobileSettingsInlineNotice>
          )}
        </MobileSettingsSection>
      ) : null}

      {activeTab === "ai" ? (
        <MobileSettingsSection
          desktop={desktopMode}
          title={desktopMode ? t(msg`AI 设置`) : undefined}
          description={
            desktopMode
              ? t(
                  msg`你可以为当前世界主人单独配置专属 API Key 和兼容 Base URL。`,
                )
              : t(msg`专属 API Key 与兼容 Base URL`)
          }
        >
          {ownerQuery.isLoading ? (
            desktopMode ? (
              <LoadingBlock
                className="px-0 py-0 text-left"
                label={t(msg`读取配置...`)}
              />
            ) : (
              <MobileSettingsStatusCard
                badge={t(msg`读取中`)}
                title={t(msg`正在加载 AI 配置`)}
                description={t(msg`稍等一下，正在同步当前世界主人的专属配置。`)}
                tone="loading"
              />
            )
          ) : null}
          {ownerQuery.isError && ownerQuery.error instanceof Error ? (
            desktopMode ? (
              <ErrorBlock message={ownerQuery.error.message} />
            ) : (
              <MobileSettingsStatusCard
                badge={t(msg`读取失败`)}
                title={t(msg`AI 设置暂时不可用`)}
                description={ownerQuery.error.message}
                tone="danger"
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 rounded-full border-[color:var(--border-subtle)] bg-white px-3.5 text-[11px]"
                      onClick={handleRetryOwnerLoad}
                    >
                      {t(msg`重试读取`)}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 rounded-full border-[color:var(--border-subtle)] bg-white px-3.5 text-[11px]"
                      onClick={handleMobileBack}
                    >
                      {mobileBackLabel}
                    </Button>
                  </div>
                }
              />
            )
          ) : null}
          {ownerQuery.data ? (
            desktopMode ? (
              <InlineNotice
                tone={ownerQuery.data.hasCustomApiKey ? "success" : "muted"}
              >
                {ownerQuery.data.hasCustomApiKey
                  ? ownerQuery.data.customApiBase
                    ? t(
                        msg`当前使用专属 API Key，Base URL：${ownerQuery.data.customApiBase}。`,
                      )
                    : t(msg`当前使用专属 API Key。`)
                  : t(msg`当前使用实例级 Provider。`)}
              </InlineNotice>
            ) : (
              <div className="rounded-[16px] border border-[color:var(--border-faint)] bg-[#f7f7f7] px-3.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[12px] font-medium text-[color:var(--text-primary)]">
                    {t(msg`当前状态`)}
                  </div>
                  <div
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[9px] font-medium tracking-[0.03em]",
                      ownerQuery.data.hasCustomApiKey
                        ? "bg-[rgba(7,193,96,0.1)] text-[#07c160]"
                        : "bg-white text-[color:var(--text-muted)]",
                    )}
                  >
                    {ownerQuery.data.hasCustomApiKey
                      ? t(msg`专属 Key`)
                      : t(msg`实例级`)}
                  </div>
                </div>
                <div className="mt-2 text-[11px] leading-[1.35rem] text-[color:var(--text-secondary)]">
                  {ownerQuery.data.hasCustomApiKey
                    ? t(msg`当前世界主人已启用专属 API Key。`)
                    : t(msg`当前仍使用实例级 Provider 配置。`)}
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-[color:var(--text-muted)]">
                  <span>Base URL</span>
                  <span className="truncate text-right text-[color:var(--text-secondary)]">
                    {ownerQuery.data.customApiBase || t(msg`默认地址`)}
                  </span>
                </div>
              </div>
            )
          ) : null}

          <div className="space-y-2.5 rounded-[16px] border border-[color:var(--border-faint)] bg-white px-3.5 py-3">
            <MobileFieldGroup label={t(msg`专属 API Key`)}>
              <TextField
                type="password"
                value={apiKeyDraft}
                onChange={(event) => setApiKeyDraft(event.target.value)}
                placeholder={
                  ownerQuery.data?.hasCustomApiKey
                    ? t(msg`已保存专属 API Key，输入新的值可替换`)
                    : t(msg`输入你的专属 API Key`)
                }
                className="rounded-[11px] border-[color:var(--border-faint)] px-3.5 py-2.5 text-[13px] shadow-none focus:translate-y-0"
              />
            </MobileFieldGroup>
            <MobileFieldGroup label={t(msg`兼容 Base URL`)}>
              <TextField
                value={apiBaseDraft}
                onChange={(event) => setApiBaseDraft(event.target.value)}
                placeholder={t(msg`可选，例如 https://api.openai.com/v1`)}
                className="rounded-[11px] border-[color:var(--border-faint)] px-3.5 py-2.5 text-[13px] shadow-none focus:translate-y-0"
              />
            </MobileFieldGroup>
          </div>

          <div className="space-y-1.5 pt-0.5">
            <Button
              onClick={() => saveApiKeyMutation.mutate()}
              disabled={aiSettingsBusy || !apiKeyDraft.trim()}
              variant="primary"
              className={cn(
                "h-9 w-full rounded-[10px] text-[12px] text-white shadow-none",
                desktopMode
                  ? "bg-[color:var(--brand-primary)] hover:opacity-95"
                  : "bg-[#07c160] hover:bg-[#06ad56]",
              )}
            >
              {saveApiKeyMutation.isPending
                ? t(msg`保存中...`)
                : t(msg`保存专属 API Key`)}
            </Button>
            <Button
              onClick={() => clearApiKeyMutation.mutate()}
              disabled={aiSettingsBusy || !ownerQuery.data?.hasCustomApiKey}
              variant="secondary"
              className="h-9 w-full rounded-[10px] border-[color:var(--border-faint)] bg-white text-[12px] shadow-none hover:bg-[#f5f7f7]"
            >
              {clearApiKeyMutation.isPending
                ? t(msg`清除中...`)
                : t(msg`清除专属 API Key`)}
            </Button>
          </div>

          {saveApiKeyMutation.isError &&
          saveApiKeyMutation.error instanceof Error ? (
            desktopMode ? (
              <ErrorBlock message={saveApiKeyMutation.error.message} />
            ) : (
              <MobileSettingsInlineNotice
                tone="danger"
                action={
                  <button
                    type="button"
                    onClick={handleMobileBack}
                    className="shrink-0 rounded-full border border-[rgba(220,38,38,0.14)] bg-white px-2 py-0.5 text-[10px] font-medium text-[color:var(--state-danger-text)]"
                  >
                    {mobileBackLabel}
                  </button>
                }
              >
                {saveApiKeyMutation.error.message}
              </MobileSettingsInlineNotice>
            )
          ) : null}
          {clearApiKeyMutation.isError &&
          clearApiKeyMutation.error instanceof Error ? (
            desktopMode ? (
              <ErrorBlock message={clearApiKeyMutation.error.message} />
            ) : (
              <MobileSettingsInlineNotice
                tone="danger"
                action={
                  <button
                    type="button"
                    onClick={handleMobileBack}
                    className="shrink-0 rounded-full border border-[rgba(220,38,38,0.14)] bg-white px-2 py-0.5 text-[10px] font-medium text-[color:var(--state-danger-text)]"
                  >
                    {mobileBackLabel}
                  </button>
                }
              >
                {clearApiKeyMutation.error.message}
              </MobileSettingsInlineNotice>
            )
          ) : null}
          {saveApiKeyMutation.isSuccess ? (
            desktopMode ? (
              <InlineNotice tone="success">
                {t(msg`专属 API Key 已保存。`)}
              </InlineNotice>
            ) : (
              <MobileSettingsInlineNotice tone="success">
                {t(msg`专属 API Key 已保存。`)}
              </MobileSettingsInlineNotice>
            )
          ) : null}
          {clearApiKeyMutation.isSuccess ? (
            desktopMode ? (
              <InlineNotice tone="success">
                {t(msg`专属 API Key 已清除。`)}
              </InlineNotice>
            ) : (
              <MobileSettingsInlineNotice tone="success">
                {t(msg`专属 API Key 已清除。`)}
              </MobileSettingsInlineNotice>
            )
          ) : null}
        </MobileSettingsSection>
      ) : null}

      {activeTab === "language" ? (
        <MobileSettingsSection
          desktop={desktopMode}
          title={desktopMode ? t(msg`界面语言`) : undefined}
          description={
            desktopMode
              ? t(msg`切换桌面端、Web、Android、iOS 共用业务界面的显示语言。`)
              : t(msg`切换当前设备的界面语言`)
          }
        >
          <LanguageSwitcher />

          {desktopMode ? (
            <InlineNotice tone="muted">
              {t(
                msg`语言偏好按端保存；后续新增语言会自动出现在这里，不需要每个页面单独加入口。`,
              )}
            </InlineNotice>
          ) : (
            <MobileSettingsInlineNotice tone="muted">
              {t(
                msg`语言偏好会保存在当前设备；桌面端、管理后台和云控制台有各自的切换入口。`,
              )}
            </MobileSettingsInlineNotice>
          )}
        </MobileSettingsSection>
      ) : null}

      {activeTab === "legal" ? (
        <>
          {desktopMode ? null : (
            <section className="mt-1 divide-y divide-[color:var(--border-faint)] border-y border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)]">
              <MobileLinkRow
                label={t(msg`隐私政策`)}
                onClick={() =>
                  void navigate({
                    to: "/legal/privacy",
                  })
                }
              />
              <MobileLinkRow
                label={t(msg`服务条款`)}
                onClick={() =>
                  void navigate({
                    to: "/legal/terms",
                  })
                }
              />
              <MobileLinkRow
                label={t(msg`社区规范`)}
                onClick={() =>
                  void navigate({
                    to: "/legal/community",
                  })
                }
              />
            </section>
          )}

          {desktopMode ? (
            <MobileSettingsSection
              desktop
              title={t(msg`协议与规范`)}
              description={t(msg`桌面端保留当前文档切换和独立打开入口。`)}
            >
              <div className="flex gap-1 rounded-[12px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] p-1">
                {legalTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveLegalTab(tab.id)}
                    className={cn(
                      "flex-1 rounded-[10px] py-2 text-[12px] font-medium transition-all duration-[var(--motion-fast)]",
                      activeLegalTab === tab.id
                        ? "bg-white text-[color:var(--text-primary)] shadow-sm"
                        : "text-[color:var(--text-muted)] hover:bg-white/70",
                    )}
                  >
                    {t(tab.label)}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <Button
                  variant="secondary"
                  onClick={() =>
                    void navigate({
                      to:
                        activeLegalTab === "privacy"
                          ? "/legal/privacy"
                          : activeLegalTab === "terms"
                            ? "/legal/terms"
                            : "/legal/community",
                    })
                  }
                >
                  {t(msg`打开当前文档`)}
                </Button>
                <InlineNotice tone="muted">
                  {activeLegalTab === "privacy"
                    ? t(msg`查看世界隐私政策和数据使用说明。`)
                    : activeLegalTab === "terms"
                      ? t(msg`查看世界服务使用协议。`)
                      : t(msg`查看世界社区规范和反馈口径。`)}
                </InlineNotice>
              </div>
            </MobileSettingsSection>
          ) : null}
        </>
      ) : null}
      {showCloudAccountEntries ? (
        desktopMode ? (
          activeTab === "account" ? (
            <MobileSettingsSection
              desktop
              title={t(msg`云账号`)}
              description={t(
                msg`查看会员信息，或退出当前云账号并回到世界入口。`,
              )}
            >
              <div className="space-y-2">
                <Button
                  variant="secondary"
                  className="h-9 w-full rounded-[10px] border-[color:var(--border-faint)] bg-white text-[12px] shadow-none hover:bg-[#f5f7f7]"
                  onClick={() => void navigate({ to: "/profile/subscription" })}
                >
                  {t(msg`会员中心`)}
                </Button>
                <Button
                  variant="secondary"
                  className="h-9 w-full rounded-[10px] border-[rgba(220,38,38,0.14)] bg-white text-[12px] text-[#b42318] shadow-none hover:bg-[#fff5f5]"
                  onClick={handleCloudLogout}
                >
                  {t(msg`退出登录`)}
                </Button>
              </div>
            </MobileSettingsSection>
          ) : null
        ) : (
          <MobileSettingsSection
            title={undefined}
            description={t(msg`管理会员与当前云账号登录状态`)}
          >
            <div className="space-y-2">
              <Button
                variant="secondary"
                className="h-9 w-full rounded-[10px] border-[color:var(--border-faint)] bg-white text-[12px] shadow-none hover:bg-[#f5f7f7]"
                onClick={() => void navigate({ to: "/profile/subscription" })}
              >
                {t(msg`会员中心`)}
              </Button>
              <Button
                variant="secondary"
                className="h-9 w-full rounded-[10px] border-[rgba(220,38,38,0.14)] bg-white text-[12px] text-[#b42318] shadow-none hover:bg-[#fff5f5]"
                onClick={handleCloudLogout}
              >
                {t(msg`退出登录`)}
              </Button>
            </div>
          </MobileSettingsSection>
        )
      ) : null}
    </>
  );

  if (desktopMode) {
    return (
      <DesktopUtilityShell
        title={desktopSettingsRoute ? t(msg`设置`) : t(msg`资料与设置`)}
        subtitle={
          activeTab === "profile"
            ? t(msg`在桌面工作区里管理世界主人的资料与签名。`)
            : activeTab === "chat"
              ? t(msg`调整桌面和 Web 键盘聊天输入的发送快捷键。`)
              : activeTab === "ai"
                ? t(msg`管理专属 API Key 和兼容 Base URL。`)
                : activeTab === "language"
                  ? t(msg`切换当前端的界面语言和本地化格式。`)
                  : activeTab === "account"
                    ? t(msg`管理当前云账号与退出登录。`)
                    : t(msg`查看当前世界相关的协议和社区规范。`)
        }
        toolbar={
          <Button
            onClick={() => navigate({ to: desktopBackTo })}
            variant="secondary"
            className="rounded-[10px] border-[color:var(--border-faint)] bg-white shadow-none hover:bg-[#f5f7f7]"
          >
            {desktopBackLabel}
          </Button>
        }
        sidebar={
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-[color:var(--border-faint)] px-4 py-4">
              <div className="text-sm font-medium text-[color:var(--text-primary)]">
                {t(msg`设置分类`)}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3">
              <div className="space-y-1">
                {settingsTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-[12px] px-3 py-2.5 text-left text-sm transition",
                      activeTab === tab.id
                        ? "bg-[rgba(7,193,96,0.10)] text-[color:var(--text-primary)]"
                        : "text-[color:var(--text-secondary)] hover:bg-white/80 hover:text-[color:var(--text-primary)]",
                    )}
                  >
                    <span>{t(tab.label)}</span>
                    {activeTab === tab.id ? (
                      <span className="h-2 w-2 rounded-full bg-[color:var(--brand-primary)]" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
            {showCloudAccountEntries ? (
              <div className="border-t border-[color:var(--border-faint)] p-3">
                <button
                  type="button"
                  onClick={() => setActiveTab(desktopAccountTab.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[12px] px-3 py-2.5 text-left text-sm transition",
                    activeTab === desktopAccountTab.id
                      ? "bg-[rgba(220,38,38,0.08)] text-[#b42318]"
                      : "text-[#b42318] hover:bg-[#fff5f5]",
                  )}
                >
                  <span>{t(desktopAccountTab.label)}</span>
                  {activeTab === desktopAccountTab.id ? (
                    <span className="h-2 w-2 rounded-full bg-[#b42318]" />
                  ) : null}
                </button>
              </div>
            ) : null}
          </div>
        }
      >
        <div className="p-5">{content}</div>
      </DesktopUtilityShell>
    );
  }

  return (
    <AppPage className="space-y-0 bg-[color:var(--bg-canvas)] px-0 py-0">
      <TabPageTopBar
        title={t(msg`设置`)}
        titleAlign="center"
        className="mx-0 mb-0 mt-0 border-b border-[color:var(--border-faint)] bg-[rgba(247,247,247,0.94)] px-4 pb-1.5 pt-1.5 text-[color:var(--text-primary)] shadow-none"
        leftActions={
          <Button
            onClick={handleMobileBack}
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full bg-transparent text-[color:var(--text-primary)] shadow-none active:bg-black/[0.05]"
          >
            <ArrowLeft size={17} />
          </Button>
        }
      />
      <div className="space-y-1 pb-8">{content}</div>
    </AppPage>
  );
}

function MobileSettingsSection({
  desktop = false,
  title,
  description,
  children,
}: {
  desktop?: boolean;
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "space-y-2",
        desktop
          ? "rounded-[20px] border border-[color:var(--border-faint)] bg-white px-5 py-5 shadow-[var(--shadow-section)]"
          : "mt-1 border-y border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)] px-4 py-1.75",
      )}
    >
      {title || description ? (
        <div>
          {title ? (
            <div className="text-[15px] font-medium text-[color:var(--text-primary)]">
              {title}
            </div>
          ) : null}
          {description ? (
            <div className="mt-0.5 text-[11px] leading-[1.35rem] text-[color:var(--text-muted)]">
              {description}
            </div>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function MobileSettingsInlineNotice({
  children,
  tone,
  action,
}: {
  children: ReactNode;
  tone: "muted" | "success" | "danger";
  action?: ReactNode;
}) {
  return (
    <InlineNotice
      tone={tone}
      className="rounded-[11px] px-2.5 py-1.5 text-[10px] leading-4 shadow-none"
    >
      {action ? (
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 flex-1">{children}</span>
          {action}
        </div>
      ) : (
        children
      )}
    </InlineNotice>
  );
}

function MobileSettingsStatusCard({
  badge,
  title,
  description,
  tone = "default",
  action,
}: {
  badge: string;
  title: string;
  description: string;
  tone?: "default" | "danger" | "loading";
  action?: ReactNode;
}) {
  const loading = tone === "loading";
  return (
    <section
      className={cn(
        "rounded-[16px] border px-3.5 py-4 text-center shadow-none",
        tone === "danger"
          ? "border-[color:var(--border-danger)] bg-[linear-gradient(180deg,rgba(255,245,245,0.96),rgba(254,242,242,0.94))]"
          : "border-[color:var(--border-faint)] bg-[#f7f7f7]",
      )}
    >
      <div
        className={cn(
          "mx-auto inline-flex rounded-full px-2.5 py-1 text-[9px] font-medium tracking-[0.03em]",
          tone === "danger"
            ? "bg-[rgba(220,38,38,0.08)] text-[color:var(--state-danger-text)]"
            : "bg-[rgba(7,193,96,0.1)] text-[#07c160]",
        )}
      >
        {badge}
      </div>
      {loading ? (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-black/15 animate-pulse" />
          <span className="h-2 w-2 rounded-full bg-black/25 animate-pulse [animation-delay:120ms]" />
          <span className="h-2 w-2 rounded-full bg-[#8ecf9d] animate-pulse [animation-delay:240ms]" />
        </div>
      ) : null}
      <div className="mt-3 text-[14px] font-medium text-[color:var(--text-primary)]">
        {title}
      </div>
      <p className="mx-auto mt-2 max-w-[18rem] text-[11px] leading-[1.35rem] text-[color:var(--text-secondary)]">
        {description}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </section>
  );
}

function MobileFieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-medium text-[color:var(--text-secondary)]">
        {label}
      </div>
      {children}
    </label>
  );
}

function MobileLinkRow({
  label,
  subtitle,
  onClick,
}: {
  label: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-4 py-2.25 text-left transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)] hover:bg-[color:var(--surface-card-hover)]"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-[color:var(--text-primary)]">
          {label}
        </div>
        {subtitle ? (
          <div className="mt-0.5 text-[10px] leading-4 text-[color:var(--text-muted)]">
            {subtitle}
          </div>
        ) : null}
      </div>
      <div className="text-[12px] text-[color:var(--text-dim)]">›</div>
    </button>
  );
}
