import en, { type EnglishTranslations } from "./en.ts";
import ru from "./ru.ts";
import type { TranslationShape } from "./translation-shape.ts";

export type Locale = "ru" | "en";
export type Translations = TranslationShape<EnglishTranslations>;

export const LOCALE_STORAGE_KEY = "anti-match.locale";
export const SUPPORTED_LOCALES: readonly Locale[] = ["ru", "en"];

const dictionaries: Record<Locale, Translations> = { en, ru };
const localeListeners = new Set<(locale: Locale) => void>();
let currentLocale: Locale = "en";

function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const language = value.trim().toLowerCase().split(/[-_]/)[0];
  return language === "ru" || language === "en" ? language : null;
}

export function detectDeviceLocale(
  languages: readonly string[] = typeof navigator === "undefined"
    ? []
    : navigator.languages?.length ? navigator.languages : [navigator.language],
): Locale {
  for (const language of languages) {
    const locale = normalizeLocale(language);
    if (locale) return locale;
  }
  return "en";
}

function readSavedLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
}

function syncDocumentLocale(): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = currentLocale;
  document.title = getTranslations().app.name;
}

export function initializeLocale(): Locale {
  currentLocale = readSavedLocale() ?? detectDeviceLocale();
  syncDocumentLocale();
  return currentLocale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  if (!SUPPORTED_LOCALES.includes(locale)) return;
  const changed = locale !== currentLocale;
  currentLocale = locale;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The selected locale still applies for this session when storage is unavailable.
  }
  syncDocumentLocale();
  if (!changed) return;
  for (const listener of localeListeners) listener(locale);
}

export function subscribeToLocaleChange(listener: (locale: Locale) => void): () => void {
  localeListeners.add(listener);
  return () => localeListeners.delete(listener);
}

export function getTranslations(): Translations {
  return dictionaries[currentLocale];
}

export function getIntlLocale(locale: Locale = currentLocale): "ru-RU" | "en-US" {
  return locale === "ru" ? "ru-RU" : "en-US";
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(getIntlLocale()).format(value);
}

export function formatDateTime(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(getIntlLocale(), {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}
