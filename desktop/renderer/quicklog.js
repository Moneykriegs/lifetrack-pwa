'use strict';
// Quick-log overlay renderer. Reuses the shared DB (same localStorage as the
// HUD window). Feature-detects window.desktop so it also renders in a browser.

const QL = {
  init() {
    // Match the HUD theme if one is set (Phase 3).
    document.documentElement.dataset.theme = localStorage.getItem('lt_hud_theme') || '';

    document.querySelectorAll('[data-water]').forEach(b =>
      b.addEventListener('click', () => this.logWater(+b.dataset.water)));

    document.getElementById('ql-form').addEventListener('submit', e => {
      e.preventDefault();
      this.logFood();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.close();
    });

    // Refocus the input each time the overlay is shown.
    window.addEventListener('focus', () => {
      const i = document.getElementById('ql-input');
      i.value = ''; i.focus();
    });
  },

  logWater(ml) {
    DB.addWater(ml);
    this.done();
  },

  logFood() {
    const raw = document.getElementById('ql-input').value.trim();
    if (!raw) return;
    // Parse a trailing number as kcal: "Manzana 95" → { name: 'Manzana', kcal: 95 }
    const m = raw.match(/^(.*?)[\s]+(\d{1,5})\s*$/);
    const name = (m ? m[1] : raw).trim() || 'Alimento';
    const kcal = m ? parseInt(m[2], 10) : 0;
    DB.addFood({ name, kcal, qty: 1 });
    this.done();
  },

  done() {
    if (window.desktop) window.desktop.dataChanged();
    this.close();
  },

  close() {
    document.getElementById('ql-input').value = '';
    if (window.desktop) window.desktop.closeQuickLog();
  },
};

window.addEventListener('DOMContentLoaded', () => QL.init());
