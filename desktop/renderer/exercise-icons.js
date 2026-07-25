'use strict';
// ════════════════════════════════════════════════════════════════
// ExerciseIcons — animated stick-figure silhouettes for the tracked lifts.
//
// Each icon is a side-view figure with articulated joints: limb segments are
// nested groups whose transform-origin sits on the parent joint, so rotating
// a thigh carries the shin with it (and the shin counter-rotates to keep the
// foot roughly planted). Motion is CSS-driven, so it costs nothing to run and
// inherits the theme color via `currentColor`.
//
// The `animated` class starts the loop — used on hover / active states so a
// list of icons isn't all wiggling at once.
// ════════════════════════════════════════════════════════════════

const ExerciseIcons = {
  // Shared bar + plates, drawn at a given y
  _bar(y, halfW = 11) {
    return `
      <line class="ex-bar" x1="${20 - halfW}" y1="${y}" x2="${20 + halfW}" y2="${y}"/>
      <rect class="ex-plate" x="${20 - halfW - 1.5}" y="${y - 3.5}" width="3" height="7" rx="1"/>
      <rect class="ex-plate" x="${20 + halfW - 1.5}" y="${y - 3.5}" width="3" height="7" rx="1"/>`;
  },

  squat() {
    return `
      <g class="ex-fig ex-squat">
        <g class="ex-up">
          <circle class="ex-head" cx="20" cy="7" r="3"/>
          ${this._bar(12)}
          <line class="ex-seg" x1="20" y1="10" x2="20" y2="21"/>
          <g class="ex-thigh">
            <line class="ex-seg" x1="20" y1="21" x2="26" y2="27"/>
            <g class="ex-shin">
              <line class="ex-seg" x1="26" y1="27" x2="26" y2="35"/>
            </g>
          </g>
        </g>
        <line class="ex-ground" x1="12" y1="36" x2="30" y2="36"/>
      </g>`;
  },

  bench() {
    // Lying on a bench, pressing the bar up and down
    return `
      <g class="ex-fig ex-bench">
        <rect class="ex-bench-pad" x="9" y="24" width="24" height="3.5" rx="1.5"/>
        <line class="ex-seg" x1="11" y1="27" x2="11" y2="34"/>
        <line class="ex-seg" x1="31" y1="27" x2="31" y2="34"/>
        <circle class="ex-head" cx="12" cy="20" r="3"/>
        <line class="ex-seg" x1="15" y1="23" x2="28" y2="23"/>
        <g class="ex-press">
          <line class="ex-seg" x1="20" y1="23" x2="20" y2="14"/>
          ${this._bar(13, 9)}
        </g>
        <line class="ex-ground" x1="7" y1="36" x2="35" y2="36"/>
      </g>`;
  },

  deadlift() {
    // Hip hinge: torso rotates up from a bent position, bar rises with it
    return `
      <g class="ex-fig ex-deadlift">
        <g class="ex-hinge">
          <circle class="ex-head" cx="20" cy="9" r="3"/>
          <line class="ex-seg" x1="20" y1="12" x2="20" y2="22"/>
          <line class="ex-arm" x1="20" y1="14" x2="20" y2="26"/>
        </g>
        <line class="ex-seg" x1="20" y1="22" x2="22" y2="30"/>
        <line class="ex-seg" x1="22" y1="30" x2="22" y2="35"/>
        <g class="ex-liftbar">${this._bar(27, 10)}</g>
        <line class="ex-ground" x1="10" y1="36" x2="32" y2="36"/>
      </g>`;
  },

  ohp() {
    // Overhead press: bar travels from shoulders to lockout
    return `
      <g class="ex-fig ex-ohp">
        <circle class="ex-head" cx="20" cy="12" r="3"/>
        <line class="ex-seg" x1="20" y1="15" x2="20" y2="26"/>
        <line class="ex-seg" x1="20" y1="26" x2="17" y2="35"/>
        <line class="ex-seg" x1="20" y1="26" x2="23" y2="35"/>
        <g class="ex-overhead">
          <line class="ex-arm" x1="15" y1="16" x2="15" y2="9"/>
          <line class="ex-arm" x1="25" y1="16" x2="25" y2="9"/>
          ${this._bar(8, 10)}
        </g>
        <line class="ex-ground" x1="12" y1="36" x2="28" y2="36"/>
      </g>`;
  },

  // Fallback for free-text exercises in the weekly plan
  generic() {
    return `
      <g class="ex-fig ex-generic">
        <line class="ex-bar" x1="8" y1="20" x2="32" y2="20"/>
        <rect class="ex-plate" x="6" y="14" width="4" height="12" rx="1.5"/>
        <rect class="ex-plate" x="30" y="14" width="4" height="12" rx="1.5"/>
        <rect class="ex-plate" x="11" y="16" width="3" height="8" rx="1"/>
        <rect class="ex-plate" x="26" y="16" width="3" height="8" rx="1"/>
      </g>`;
  },

  /**
   * Returns the inline SVG for a lift id (or the generic bar if unknown).
   * @param {string} id     squat | bench | deadlift | ohp
   * @param {object} opts   { size = 28, animated = false, title = '' }
   */
  svg(id, opts = {}) {
    const { size = 28, animated = false, title = '' } = opts;
    const body = (typeof this[id] === 'function' && id !== 'svg' && id !== 'generic')
      ? this[id]() : this.generic();
    return `<svg class="ex-icon${animated ? ' animated' : ''}" width="${size}" height="${size}"
      viewBox="0 0 40 40" fill="none" aria-hidden="true">${title ? `<title>${title}</title>` : ''}${body}</svg>`;
  },

  /** True when we have a dedicated silhouette for this lift id. */
  has(id) { return ['squat', 'bench', 'deadlift', 'ohp'].includes(id); },
};
