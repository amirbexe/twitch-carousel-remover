(function () {
  'use strict';

  const listEl = document.getElementById('sections-list');
  const resetBtn = document.getElementById('reset-btn');

  let sections = [];
  let order = [];
  let hidden = {};
  let dragSrcEl = null;

  function init() {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tab = tabs[0];
      if (!tab || !tab.url || !tab.url.includes('twitch.tv')) {
        listEl.innerHTML = '<div class="no-sections">Navigate to <strong>twitch.tv</strong> to see sections.</div>';
        return;
      }

      chrome.tabs.sendMessage(tab.id, { type: 'getSections' }, response => {
        if (chrome.runtime.lastError || !response) {
          listEl.innerHTML = '<div class="no-sections">Reload the Twitch page and try again.</div>';
          return;
        }

        sections = response.sections || [];
        order = response.order || [];
        sections.forEach(s => { hidden[s.id] = s.hidden; });

        if (sections.length === 0) {
          listEl.innerHTML = '<div class="no-sections">No sections detected.<br>Make sure you\'re on the Twitch homepage.</div>';
          return;
        }

        // Sort sections by saved order
        if (order.length > 0) {
          sections.sort((a, b) => {
            const ai = order.indexOf(a.id);
            const bi = order.indexOf(b.id);
            if (ai === -1 && bi === -1) return 0;
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
          });
        }

        render();
      });
    });
  }

  function render() {
    listEl.innerHTML = '';
    sections.forEach(section => {
      const row = document.createElement('div');
      row.className = 'section-row' + (hidden[section.id] ? ' is-hidden' : '');
      row.dataset.id = section.id;
      row.draggable = true;

      row.innerHTML = `
        <span class="drag-handle">&#x2630;</span>
        <span class="section-name" title="${escapeHtml(section.name)}">${escapeHtml(section.name)}</span>
        <label class="toggle">
          <input type="checkbox" ${!hidden[section.id] ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      `;

      const checkbox = row.querySelector('input');
      checkbox.addEventListener('change', () => {
        hidden[section.id] = !checkbox.checked;
        row.classList.toggle('is-hidden', hidden[section.id]);
        pushUpdate();
      });

      // Drag events
      row.addEventListener('dragstart', handleDragStart);
      row.addEventListener('dragover', handleDragOver);
      row.addEventListener('dragenter', handleDragEnter);
      row.addEventListener('dragleave', handleDragLeave);
      row.addEventListener('drop', handleDrop);
      row.addEventListener('dragend', handleDragEnd);

      listEl.appendChild(row);
    });
  }

  function handleDragStart(e) {
    dragSrcEl = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.id);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDragEnter(e) {
    e.preventDefault();
    this.classList.add('drag-over');
  }

  function handleDragLeave() {
    this.classList.remove('drag-over');
  }

  function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    if (dragSrcEl !== this) {
      // Reorder in the DOM
      const allRows = Array.from(listEl.querySelectorAll('.section-row'));
      const fromIndex = allRows.indexOf(dragSrcEl);
      const toIndex = allRows.indexOf(this);

      if (fromIndex < toIndex) {
        listEl.insertBefore(dragSrcEl, this.nextSibling);
      } else {
        listEl.insertBefore(dragSrcEl, this);
      }

      // Update sections array order
      const movedSection = sections.splice(fromIndex, 1)[0];
      const newToIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
      sections.splice(newToIndex + (toIndex > fromIndex ? 1 : 0), 0, movedSection);

      pushUpdate();
    }

    this.classList.remove('drag-over');
  }

  function handleDragEnd() {
    document.querySelectorAll('.section-row').forEach(row => {
      row.classList.remove('dragging', 'drag-over');
    });
  }

  function pushUpdate() {
    order = sections.map(s => s.id);

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tab = tabs[0];
      if (!tab) return;
      chrome.tabs.sendMessage(tab.id, {
        type: 'updateSettings',
        hidden: hidden,
        order: order
      });
    });
  }

  resetBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tab = tabs[0];
      if (!tab) return;
      chrome.tabs.sendMessage(tab.id, { type: 'resetSettings' }, () => {
        hidden = {};
        order = [];
        sections.forEach(s => { s.hidden = false; });
        render();
      });
    });
  });

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  init();
})();
