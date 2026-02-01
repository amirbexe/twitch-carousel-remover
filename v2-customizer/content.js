(function () {
  'use strict';

  const STORAGE_KEY = 'twitchCustomizer';
  let settings = { hidden: {}, order: [] };
  let editMode = false;
  let sections = [];
  let shelfContainer = null;
  let toolbar = null;
  let hiddenPanel = null;
  let dragSrc = null;
  let navButtonInjected = false;

  // ── Storage ──

  function loadSettings() {
    return new Promise(resolve => {
      chrome.storage.local.get(STORAGE_KEY, data => {
        if (data[STORAGE_KEY]) {
          settings = data[STORAGE_KEY];
          if (!settings.hidden) settings.hidden = {};
          if (!settings.order) settings.order = [];
        }
        resolve();
      });
    });
  }

  function saveSettings() {
    chrome.storage.local.set({ [STORAGE_KEY]: settings });
  }

  // ── Utility ──

  function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
  }

  // ── Section Detection ──

  function detectSections() {
    sections = [];
    shelfContainer = null;

    // 1. Carousel
    const carousel = document.querySelector('.front-page-carousel');
    if (carousel) {
      sections.push({ id: 'carousel', name: 'Featured Carousel', element: carousel, type: 'fixed' });
    }

    // 2. Left Sidebar
    const sideNav = document.querySelector('.side-nav');
    if (sideNav) {
      sections.push({ id: 'side-nav', name: 'Left Sidebar', element: sideNav, type: 'fixed' });
    }

    // 3. Top Navigation
    const topNav = document.querySelector('nav.top-nav') || document.querySelector('[data-a-target="top-nav-container"]');
    if (topNav) {
      sections.push({ id: 'top-nav', name: 'Top Navigation Bar', element: topNav, type: 'fixed' });
    }

    // 4. Shelves — find using carousel sibling approach
    const carouselEl = document.querySelector('.front-page-carousel');
    let contentContainer = null;

    if (carouselEl && carouselEl.parentElement) {
      Array.from(carouselEl.parentElement.children).forEach(child => {
        if (!child.classList.contains('front-page-carousel') && child.offsetHeight > 100) {
          contentContainer = child;
        }
      });
    }

    if (contentContainer) {
      // Walk down to find the parent with multiple h2-containing children
      function findShelfParent(el, depth) {
        if (depth > 5) return null;
        var kids = Array.from(el.children);
        var kidsWithH2 = kids.filter(function (k) { return k.querySelector('h2'); });
        if (kidsWithH2.length >= 2) return el;
        for (var i = 0; i < kids.length; i++) {
          var found = findShelfParent(kids[i], depth + 1);
          if (found) return found;
        }
        return null;
      }

      shelfContainer = findShelfParent(contentContainer, 0);

      if (shelfContainer) {
        Array.from(shelfContainer.children).forEach(function (child) {
          var h2 = child.querySelector('h2');
          if (h2) {
            var name = h2.textContent.trim();
            var id = slugify(name);
            sections.push({ id: id, name: name, element: child, type: 'shelf' });
          }
        });
      }
    }

    return sections;
  }

  // ── Apply Layout (locked mode) ──

  function applyLayout() {
    if (editMode) return;
    detectSections();

    sections.forEach(function (s) {
      if (settings.hidden[s.id]) {
        s.element.style.display = 'none';
      } else {
        s.element.style.display = '';
      }
    });

    // Reorder shelves
    if (settings.order.length > 0 && shelfContainer) {
      var shelfMap = {};
      sections.filter(function (s) { return s.type === 'shelf'; }).forEach(function (s) {
        shelfMap[s.id] = s.element;
      });

      var ordered = settings.order.filter(function (k) { return shelfMap[k]; });
      ordered.forEach(function (key) {
        var el = shelfMap[key];
        if (el && el.parentElement === shelfContainer) {
          shelfContainer.appendChild(el);
        }
      });

      sections.filter(function (s) { return s.type === 'shelf'; }).forEach(function (s) {
        if (ordered.indexOf(s.id) === -1 && s.element.parentElement === shelfContainer) {
          shelfContainer.appendChild(s.element);
        }
      });
    }

    injectNavButton();
  }

  // ── Nav Bar Button ──

  function injectNavButton() {
    if (document.getElementById('tc-nav-btn')) return;

    // Find the prime offers button and insert before it
    var primeBtn = document.querySelector('[data-a-target="prime-offers-icon"]');
    if (!primeBtn) return;

    var container = primeBtn.closest('div');
    if (!container || !container.parentElement) return;

    var btn = document.createElement('div');
    btn.id = 'tc-nav-btn';
    btn.title = 'Twitch Customizer — Edit Layout';
    btn.innerHTML = '<button class="tc-nav-edit-btn" aria-label="Twitch Customizer">' +
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">' +
      '<rect x="1" y="1" width="7" height="7" rx="1.5" opacity="0.9"/>' +
      '<rect x="11" y="1" width="7" height="7" rx="1.5" opacity="0.6"/>' +
      '<rect x="1" y="11" width="7" height="7" rx="1.5" opacity="0.6"/>' +
      '<rect x="11" y="11" width="7" height="7" rx="1.5" opacity="0.35"/>' +
      '</svg></button>';

    btn.querySelector('button').addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (editMode) {
        exitEditMode(false);
      } else {
        enterEditMode();
      }
    });

    container.parentElement.insertBefore(btn, container);
    navButtonInjected = true;
  }

  // ── Edit Mode ──

  function enterEditMode() {
    editMode = true;
    detectSections();

    // Reveal hidden sections so user can see them
    sections.forEach(function (s) {
      s.element.style.display = '';
    });

    document.body.classList.add('tc-edit-mode');

    // Decorate each section
    sections.forEach(function (s) {
      s.element.classList.add('tc-section');
      s.element.setAttribute('data-tc-id', s.id);

      if (settings.hidden[s.id]) {
        s.element.classList.add('tc-dimmed');
      }

      // Label badge
      var label = document.createElement('div');
      label.className = 'tc-section-label';
      label.textContent = s.name;
      s.element.appendChild(label);

      // Remove/hide button
      var removeBtn = document.createElement('button');
      removeBtn.className = 'tc-remove-btn';
      removeBtn.innerHTML = '&#215;';
      removeBtn.title = settings.hidden[s.id] ? 'Section is hidden — click Add Back in panel' : 'Hide this section';
      removeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        toggleHideSection(s);
      });
      s.element.appendChild(removeBtn);

      // Drag handle for reorderable shelves
      if (s.type === 'shelf') {
        var handle = document.createElement('div');
        handle.className = 'tc-drag-handle';
        handle.innerHTML = '&#9776;';
        handle.title = 'Drag to reorder';
        s.element.appendChild(handle);

        s.element.setAttribute('draggable', 'true');
        s.element.addEventListener('dragstart', onDragStart);
        s.element.addEventListener('dragover', onDragOver);
        s.element.addEventListener('dragenter', onDragEnter);
        s.element.addEventListener('dragleave', onDragLeave);
        s.element.addEventListener('drop', onDrop);
        s.element.addEventListener('dragend', onDragEnd);
      }
    });

    // Update nav button to show active state
    var navBtn = document.querySelector('.tc-nav-edit-btn');
    if (navBtn) navBtn.classList.add('tc-active');

    showToolbar();
  }

  function exitEditMode(save) {
    editMode = false;
    document.body.classList.remove('tc-edit-mode');

    if (save) {
      if (shelfContainer) {
        var currentOrder = [];
        Array.from(shelfContainer.children).forEach(function (child) {
          var match = sections.find(function (s) { return s.element === child; });
          if (match && match.type === 'shelf') {
            currentOrder.push(match.id);
          }
        });
        settings.order = currentOrder;
      }
      saveSettings();
    }

    // Clean up all decorations
    sections.forEach(function (s) {
      s.element.classList.remove('tc-section', 'tc-dragging', 'tc-drag-over', 'tc-dimmed');
      s.element.removeAttribute('draggable');
      s.element.removeAttribute('data-tc-id');
      s.element.querySelectorAll('.tc-section-label, .tc-remove-btn, .tc-drag-handle').forEach(function (el) { el.remove(); });
    });

    var navBtn = document.querySelector('.tc-nav-edit-btn');
    if (navBtn) navBtn.classList.remove('tc-active');

    hideToolbar();
    hideHiddenPanel();
    applyLayout();
  }

  function toggleHideSection(section) {
    if (settings.hidden[section.id]) {
      // Unhide
      delete settings.hidden[section.id];
      section.element.classList.remove('tc-dimmed');
    } else {
      // Hide
      settings.hidden[section.id] = true;
      section.element.classList.add('tc-dimmed');
    }
    updateHiddenPanel();
  }

  function unhideSection(sectionId) {
    delete settings.hidden[sectionId];
    var section = sections.find(function (s) { return s.id === sectionId; });
    if (section) {
      section.element.classList.remove('tc-dimmed');
      section.element.style.display = '';
    }
    updateHiddenPanel();
  }

  function resetAll() {
    settings = { hidden: {}, order: [] };
    saveSettings();
    exitEditMode(false);
    applyLayout();
  }

  // ── Drag and Drop ──

  function onDragStart(e) {
    dragSrc = this;
    this.classList.add('tc-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function onDragEnter(e) {
    e.preventDefault();
    if (this !== dragSrc) this.classList.add('tc-drag-over');
  }

  function onDragLeave() {
    this.classList.remove('tc-drag-over');
  }

  function onDrop(e) {
    e.stopPropagation();
    e.preventDefault();
    if (dragSrc && dragSrc !== this && shelfContainer) {
      var allChildren = Array.from(shelfContainer.children);
      var fromIdx = allChildren.indexOf(dragSrc);
      var toIdx = allChildren.indexOf(this);
      if (fromIdx < toIdx) {
        shelfContainer.insertBefore(dragSrc, this.nextSibling);
      } else {
        shelfContainer.insertBefore(dragSrc, this);
      }
    }
    this.classList.remove('tc-drag-over');
  }

  function onDragEnd() {
    sections.forEach(function (s) {
      s.element.classList.remove('tc-dragging', 'tc-drag-over');
    });
    dragSrc = null;
  }

  // ── Toolbar ──

  function createToolbar() {
    if (toolbar) return;
    toolbar = document.createElement('div');
    toolbar.className = 'tc-toolbar';
    toolbar.innerHTML =
      '<span class="tc-toolbar-title">\u270E EDIT MODE</span>' +
      '<button class="tc-toolbar-btn tc-btn-save">\u2714 Save &amp; Lock</button>' +
      '<button class="tc-toolbar-btn tc-btn-restore">\u21A9 Hidden Sections</button>' +
      '<button class="tc-toolbar-btn tc-btn-reset">\u21BB Reset All</button>' +
      '<button class="tc-toolbar-btn tc-btn-cancel">\u2716 Cancel</button>';

    toolbar.querySelector('.tc-btn-save').addEventListener('click', function () { exitEditMode(true); });
    toolbar.querySelector('.tc-btn-restore').addEventListener('click', toggleHiddenPanel);
    toolbar.querySelector('.tc-btn-reset').addEventListener('click', resetAll);
    toolbar.querySelector('.tc-btn-cancel').addEventListener('click', function () { exitEditMode(false); });
    document.body.appendChild(toolbar);
  }

  function showToolbar() {
    createToolbar();
    toolbar.classList.add('tc-visible');
  }

  function hideToolbar() {
    if (toolbar) toolbar.classList.remove('tc-visible');
  }

  // ── Hidden Sections Panel ──

  function createHiddenPanel() {
    if (hiddenPanel) return;
    hiddenPanel = document.createElement('div');
    hiddenPanel.className = 'tc-hidden-panel';
    document.body.appendChild(hiddenPanel);
  }

  function updateHiddenPanel() {
    if (!hiddenPanel) return;
    var hiddenSections = sections.filter(function (s) { return settings.hidden[s.id]; });

    if (hiddenSections.length === 0) {
      hiddenPanel.innerHTML =
        '<div class="tc-hidden-panel-title">Hidden Sections</div>' +
        '<div class="tc-no-hidden">No hidden sections. Click the \u00D7 on any section to hide it.</div>';
      return;
    }

    hiddenPanel.innerHTML = '<div class="tc-hidden-panel-title">Hidden Sections (' + hiddenSections.length + ')</div>';
    hiddenSections.forEach(function (s) {
      var item = document.createElement('div');
      item.className = 'tc-hidden-item';
      var nameSpan = document.createElement('span');
      nameSpan.className = 'tc-hidden-item-name';
      nameSpan.textContent = s.name;
      var addBtn = document.createElement('button');
      addBtn.className = 'tc-hidden-item-add';
      addBtn.textContent = '+ Add Back';
      addBtn.addEventListener('click', function () { unhideSection(s.id); });
      item.appendChild(nameSpan);
      item.appendChild(addBtn);
      hiddenPanel.appendChild(item);
    });
  }

  function toggleHiddenPanel() {
    createHiddenPanel();
    updateHiddenPanel();
    hiddenPanel.classList.toggle('tc-visible');
  }

  function hideHiddenPanel() {
    if (hiddenPanel) hiddenPanel.classList.remove('tc-visible');
  }

  // ── Message Listener (from background.js icon click) ──

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.type === 'toggleEditor') {
      if (editMode) exitEditMode(false);
      else enterEditMode();
      sendResponse({ ok: true });
      return true;
    }
  });

  // ── MutationObserver ──

  function startObserver() {
    var debounceTimer = null;
    var observer = new MutationObserver(function () {
      if (editMode) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        applyLayout();
      }, 500);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Init ──

  async function init() {
    await loadSettings();
    applyLayout();
    startObserver();
    setTimeout(applyLayout, 1500);
    setTimeout(applyLayout, 4000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
