"use client";
import { useEffect, useState, type ReactNode } from "react";
import { I18nProvider } from "@lingui/react";
import { setupI18n, type Messages } from "@lingui/core";
import type { SupportedLocale } from "@/lib/locales";

export function SiteI18nClientProvider({
  locale,
  messages,
  children,
}: {
  locale: SupportedLocale;
  messages: Messages;
  children: ReactNode;
}) {
  const [i18n] = useState(() => {
    const inst = setupI18n();
    inst.load(locale, messages);
    inst.activate(locale);
    return inst;
  });

  useEffect(() => {
    if (i18n.locale !== locale) {
      i18n.load(locale, messages);
      i18n.activate(locale);
    }
  }, [i18n, locale, messages]);

  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}
