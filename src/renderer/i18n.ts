import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

// Locale resources are imported at build time
import en from '../../locales/en.json';
import zhCN from '../../locales/zh-CN.json';

const DEFAULT_LANGUAGE = 'en';

async function detectLanguage(): Promise<string> {
  try {
    if (window.hicc?.getLanguage) {
      const lang = await window.hicc.getLanguage();
      if (lang && ['en', 'zh-CN'].includes(lang)) return lang;
    }
  } catch {
    // Fallback to navigator or default
  }
  // Detect from browser language
  const navLang = navigator.language;
  if (navLang?.startsWith('zh')) return 'zh-CN';
  return DEFAULT_LANGUAGE;
}

const i18n = i18next.createInstance();

export async function initI18n(): Promise<typeof i18next> {
  const detectedLang = await detectLanguage();

  await i18n
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        'zh-CN': { translation: zhCN },
      },
      lng: detectedLang,
      fallbackLng: DEFAULT_LANGUAGE,
      interpolation: {
        escapeValue: false, // React already escapes
      },
    });

  return i18n;
}

export function changeLanguage(lang: string): void {
  i18n.changeLanguage(lang);
  // Persist to config
  window.hicc?.setLanguage?.(lang)?.catch(() => {});
}

export default i18n;
