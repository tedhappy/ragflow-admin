//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import translation_en from './en';
import translation_zh from './zh';

// Supported languages
export enum Language {
  En = 'en',
  Zh = 'zh',
}

// Language display names
export const LanguageMap: Record<Language, string> = {
  [Language.En]: 'English',
  [Language.Zh]: '简体中文',
};

// i18n resources
const resources = {
  [Language.En]: translation_en,
  [Language.Zh]: translation_zh,
};

// Initialize i18n
i18n
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    detection: {
      lookupLocalStorage: 'ragflow_admin_lng',
      order: ['localStorage', 'navigator'],
    },
    supportedLngs: Object.values(Language),
    resources,
    fallbackLng: Language.En,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
