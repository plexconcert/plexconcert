/**
 * PlexConcert — i18n (Internationalisation)
 * Loads JSON translation files, swaps text via data-i18n attributes,
 * persists choice in localStorage.
 */

(function () {
  const SUPPORTED = ['en', 'de', 'fr', 'es'];
  const LABELS = { en: 'EN', de: 'DE', fr: 'FR', es: 'ES' };
  const CACHE = {};

  // --- Detect initial language ---
  function detectLang() {
    // 1. localStorage
    const stored = localStorage.getItem('plexconcert-lang');
    if (stored && SUPPORTED.includes(stored)) return stored;

    // 2. Browser language
    const browserLang = (navigator.language || '').slice(0, 2).toLowerCase();
    if (SUPPORTED.includes(browserLang)) return browserLang;

    // 3. Default
    return 'en';
  }

  // --- Fetch translation JSON (cached) ---
  async function loadTranslation(lang) {
    if (CACHE[lang]) return CACHE[lang];
    try {
      const res = await fetch(`lang/${lang}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      CACHE[lang] = data;
      return data;
    } catch (err) {
      console.warn(`[i18n] Could not load lang/${lang}.json`, err);
      return null;
    }
  }

  // --- Apply translations to the DOM ---
  function applyTranslation(data) {
    if (!data) return;

    // data-i18n="key" → textContent
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (data[key] !== undefined) {
        el.textContent = data[key];
      }
    });

    // data-i18n-html="key" → innerHTML (for <br>, <span>, <em> etc.)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (data[key] !== undefined) {
        el.innerHTML = data[key];
      }
    });

    // data-i18n-attr="attr:key" → element attribute (e.g. placeholder, content)
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
      const pairs = el.getAttribute('data-i18n-attr').split(';');
      pairs.forEach(pair => {
        const [attr, key] = pair.split(':').map(s => s.trim());
        if (attr && key && data[key] !== undefined) {
          el.setAttribute(attr, data[key]);
        }
      });
    });

    // Update <html lang="">
    const lang = localStorage.getItem('plexconcert-lang') || 'en';
    document.documentElement.lang = lang;
  }

  // --- Update picker UI ---
  function updatePickerUI(lang) {
    const current = document.getElementById('langPickerCurrent');
    if (current) current.textContent = LABELS[lang] || lang.toUpperCase();

    document.querySelectorAll('.lang-option').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
  }

  // --- Switch language ---
  async function switchLang(lang) {
    if (!SUPPORTED.includes(lang)) return;
    localStorage.setItem('plexconcert-lang', lang);
    const data = await loadTranslation(lang);
    applyTranslation(data);
    updatePickerUI(lang);

    // Close menu
    const menu = document.getElementById('langPickerMenu');
    if (menu) menu.classList.remove('open');
  }

  // --- Expose for form handler ---
  window.plexI18n = {
    get: async function (key) {
      const lang = localStorage.getItem('plexconcert-lang') || 'en';
      const data = await loadTranslation(lang);
      return data ? data[key] : undefined;
    },
    getSync: function (key) {
      const lang = localStorage.getItem('plexconcert-lang') || 'en';
      const data = CACHE[lang];
      return data ? data[key] : undefined;
    }
  };

  // --- Init ---
  async function init() {
    const lang = detectLang();
    localStorage.setItem('plexconcert-lang', lang);

    // Preload current language
    const data = await loadTranslation(lang);

    // Only apply if not English (English is already in the HTML)
    if (lang !== 'en') {
      applyTranslation(data);
    }
    updatePickerUI(lang);

    // Picker toggle
    const pickerBtn = document.getElementById('langPickerBtn');
    const pickerMenu = document.getElementById('langPickerMenu');

    if (pickerBtn && pickerMenu) {
      pickerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        pickerMenu.classList.toggle('open');
      });

      // Language option clicks
      pickerMenu.querySelectorAll('.lang-option').forEach(btn => {
        btn.addEventListener('click', () => {
          const newLang = btn.getAttribute('data-lang');
          switchLang(newLang);
        });
      });

      // Close on outside click
      document.addEventListener('click', () => {
        pickerMenu.classList.remove('open');
      });
    }
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
