import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import es from "./locales/es.json";
import en from "./locales/en.json";
import zh from "./locales/zh.json";
import fr from "./locales/fr.json";
import ja from "./locales/ja.json";
import it from "./locales/it.json";
import pt from "./locales/pt.json";

export const LANGUAGES = [
  { code: "es", label: "Español", flag: "es", sigla: "ES" },
  { code: "en", label: "English", flag: "gb", sigla: "EN" },
  { code: "zh", label: "中文", flag: "cn", sigla: "ZH" },
  { code: "fr", label: "Français", flag: "fr", sigla: "FR" },
  { code: "ja", label: "日本語", flag: "jp", sigla: "JA" },
  { code: "it", label: "Italiano", flag: "it", sigla: "IT" },
  { code: "pt", label: "Português", flag: "pt", sigla: "PT" },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
      zh: { translation: zh },
      fr: { translation: fr },
      ja: { translation: ja },
      it: { translation: it },
      pt: { translation: pt },
    },
    fallbackLng: "es",
    supportedLngs: ["es", "en", "zh", "fr", "ja", "it", "pt"],
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "eco_lang",
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
