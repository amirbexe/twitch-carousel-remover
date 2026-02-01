(function () {
  'use strict';

  const STORAGE_KEY = 'twitchCustomizer';

  const DEFAULT_SETTINGS = {
    hidden: { carousel: true },
    order: []
  };

  let settings = null;
  let appliedCount = 0;

  function loadSettings() {
    return new Promise(resolve => {
      chrome.storage.local.get(STORAGE_KEY, data => {
        settings = Object.assign({}, DEFAULT_SETTINGS, data[STORAGE_KEY]);
        if (!settings.hidden) settings.hidden = { carousel: true };
        if (!settings.order) settings.order = [];
        resolve(settings);
      });
    });
  }

  function saveSettings() {
    chrome.storage.local.set({ [STORAGE_KEY]: settings });
  }

  function getCarousel() {
    return document.querySelector('.front-page-carousel');
  }

  function getShelves() {
    const allH2 = document.querySelectorAll('h2');
    if (allH2.length === 0) return { container: null, sections: [] };

    let el = allH2[0];
    for (let i = 0; i < 12; i++) {
      if (!el.parentElement) break;
      el = el.parentElement;
      const parent = el.parentElement;
      if (!parent) continue;
      const siblingsWithH2 = Array.from(parent.children).filter(c => c.querySelector('h2'));
      if (siblingsWithH2.length >= 2) {
        const sections = Array.from(parent.children)
          .map(child => {
            const h2 = child.querySelector('h2');
            return {
              element: child,
              name: h2 ? h2.textContent.trim() : null
            };
          })
          .filter(s => s.name);
        return { container: parent, sections };
      }
    }
    return { container: null, sections: [] };
  }

  function getSidebar() {
    return document.querySelector('[data-a-target="side-nav-bar"]')
      || document.querySelector('.side-nav');
  }

  function applySettings() {
    if (!settings) return;

    // Carousel
    const carousel = getCarousel();
    if (carousel) {
      carousel.style.display = settings.hidden.carousel ? 'none' : '';
    }

    // Sidebar
    const sidebar = getSidebar();
    if (sidebar) {
      const sidebarWrapper = sidebar.closest('.side-nav') || sidebar;
      sidebarWrapper.style.display = settings.hidden.sidebar ? 'none' : '';
    }

    // Shelves
    const { container, sections } = getShelves();
    if (!container || sections.length === 0) return;

    sections.forEach(s => {
      const key = slugify(s.name);
      if (settings.hidden[key]) {
        s.element.style.display = 'none';
      } else {
        s.element.style.display = '';
      }
    });

    // Reorder
    if (settings.order.length > 0) {
      const sectionMap = {};
      sections.forEach(s => {
        sectionMap[slugify(s.name)] = s.element;
      });

      // Apply order - move sections that are in the saved order to the top in order
      const orderedKeys = settings.order.filter(k => sectionMap[k]);
      orderedKeys.forEach(key => {
        const el = sectionMap[key];
        if (el && el.parentElement === container) {
          container.appendChild(el);
        }
      });

      // Remaining sections (not in saved order) stay at the end
      sections.forEach(s => {
        const key = slugify(s.name);
        if (!orderedKeys.includes(key) && s.element.parentElement === container) {
          container.appendChild(s.element);
        }
      });
    }

    appliedCount++;
  }

  function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
  }

  function detectAndReport() {
    const detected = [];

    const carousel = getCarousel();
    if (carousel) {
      detected.push({ id: 'carousel', name: 'Featured Carousel', hidden: !!settings.hidden.carousel });
    }

    const sidebar = getSidebar();
    if (sidebar) {
      detected.push({ id: 'sidebar', name: 'Left Sidebar', hidden: !!settings.hidden.sidebar });
    }

    const { sections } = getShelves();
    sections.forEach(s => {
      const key = slugify(s.name);
      detected.push({ id: key, name: s.name, hidden: !!settings.hidden[key] });
    });

    return detected;
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'getSections') {
      const detected = detectAndReport();
      sendResponse({ sections: detected, order: settings.order });
      return true;
    }

    if (msg.type === 'updateSettings') {
      settings.hidden = msg.hidden || settings.hidden;
      settings.order = msg.order || settings.order;
      saveSettings();
      applySettings();
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === 'resetSettings') {
      settings = { hidden: {}, order: [] };
      saveSettings();
      applySettings();
      sendResponse({ ok: true });
      return true;
    }
  });

  // MutationObserver to handle Twitch SPA navigation
  function startObserver() {
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        applySettings();
      }, 300);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Initialize
  async function init() {
    await loadSettings();
    applySettings();
    startObserver();

    // Re-apply after short delays to catch late-loading content
    setTimeout(applySettings, 1000);
    setTimeout(applySettings, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
