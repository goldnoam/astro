import { useState, useEffect, useCallback } from 'react';
import { LANGUAGE_KEY } from '../constants';

// FIX: Corrected a syntax error from `const-languages` to `const languages`.
const languages = {
  en: { name: 'English', dir: 'ltr' },
  es: { name: 'Español', dir: 'ltr' },
  fr: { name: 'Français', dir: 'ltr' },
  de: { name: 'Deutsch', dir: 'ltr' },
  pt: { name: 'Português', dir: 'ltr' },
  ru: { name: 'Русский', dir: 'ltr' },
  zh: { name: '中文', dir: 'ltr' },
  ar: { name: 'العربية', dir: 'rtl' },
  he: { name: 'עברית', dir: 'rtl' },
};

type LanguageCode = keyof typeof languages;

const getInitialLanguage = (): LanguageCode => {
    const savedLang = localStorage.getItem(LANGUAGE_KEY) as LanguageCode;
    if (savedLang && languages[savedLang]) {
        return savedLang;
    }
    const browserLang = navigator.language.split('-')[0] as LanguageCode;
    if (languages[browserLang]) {
        return browserLang;
    }
    return 'en';
};

const useLocalization = () => {
    const [language, setLanguageState] = useState<LanguageCode>(getInitialLanguage);
    const [translations, setTranslations] = useState<Record<string, string>>({});
    const [isLoaded, setIsLoaded] = useState(false);

    const fetchTranslations = useCallback(async (lang: LanguageCode) => {
        try {
            const response = await fetch(`/locales/${lang}.json`);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            setTranslations(data);
            setIsLoaded(true);
        } catch (error) {
            console.error(`Could not load translations for ${lang}`, error);
            if (lang !== 'en') {
                fetchTranslations('en'); // Fallback to English
            }
        }
    }, []);

    useEffect(() => {
        fetchTranslations(language);
    }, [language, fetchTranslations]);
    
    useEffect(() => {
        document.documentElement.lang = language;
        document.documentElement.dir = languages[language].dir;
    }, [language]);

    const setLanguage = (lang: LanguageCode) => {
        localStorage.setItem(LANGUAGE_KEY, lang);
        setLanguageState(lang);
    };

    const t = useCallback((key: string, options?: Record<string, string | number>) => {
        if (!isLoaded) return key;
        let translation = translations[key] || key;
        if (options) {
            Object.entries(options).forEach(([k, v]) => {
                translation = translation.replace(`{{${k}}}`, String(v));
            });
        }
        return translation;
    }, [translations, isLoaded]);

    return {
        t,
        setLanguage,
        language,
        languages,
        dir: languages[language].dir,
    };
};

export default useLocalization;
