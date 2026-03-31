import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";
import zh from "../locales/zh.json";
import zhTW from "../locales/zh-TW.json";
import ja from "../locales/ja.json";
import ko from "../locales/ko.json";
import es from "../locales/es.json";
import fr from "../locales/fr.json";
import de from "../locales/de.json";
import ru from "../locales/ru.json";
import ar from "../locales/ar.json";
import pt from "../locales/pt.json";
import vi from "../locales/vi.json";

const supportedLangs = ["en", "zh", "zh-TW", "ja", "ko", "es", "fr", "de", "ru", "ar", "pt", "vi"];
const savedLang = localStorage.getItem("taiclaw-lang") || "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
    "zh-TW": { translation: zhTW },
    ja: { translation: ja },
    ko: { translation: ko },
    es: { translation: es },
    fr: { translation: fr },
    de: { translation: de },
    ru: { translation: ru },
    ar: { translation: ar },
    pt: { translation: pt },
    vi: { translation: vi },
  },
  lng: supportedLangs.includes(savedLang) ? savedLang : "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
