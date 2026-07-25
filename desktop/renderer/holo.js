'use strict';
// ════════════════════════════════════════════════════════════════
// Holo — Three.js toolkit for the HUD's holographic charts.
//
// Design notes:
//  • Views are CACHED per canvas id. The HUD re-renders on a timer, and
//    creating a WebGLRenderer per call would exhaust the browser's ~16
//    WebGL context limit within minutes. Data updates rebuild only the
//    scene contents (with explicit geometry/material disposal).
//  • A single shared RAF loop drives every view, and skips any canvas that
//    isn't currently visible (hidden tab) so background views cost nothing.
//  • Colors read the live CSS theme vars, so Jarvis/Ultron/Matrix recolor
//    the 3D scenes for free.
// ════════════════════════════════════════════════════════════════

const Holo = {
  _views: new Map(),   // canvasId -> view
  _raf: null,

  // ── Capability check ────────────────────────────────────────────
  supported() {
    if (this._sup != null) return this._sup;
    try {
      if (typeof THREE === 'undefined') return (this._sup = false);
      const c = document.createElement('canvas');
      this._sup = !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch { this._sup = false; }
    return this._sup;
  },

  // ── Theme ───────────────────────────────────────────────────────
  css(varName, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return v || fallback;
  },
  accent() {
    const rgb = this.css('--accent-rgb', '53, 226, 255').split(',').map(n => parseInt(n, 10));
    return new THREE.Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
  },
  colorOf(cssVar, fallbackHex) {
    const v = this.css(cssVar, fallbackHex);
    try { return new THREE.Color(v); } catch { return new THREE.Color(fallbackHex); }
  },

  // ── View lifecycle ──────────────────────────────────────────────
  /** Get-or-create the persistent 3D view bound to a canvas element. */
  view(canvasId) {
    if (this._views.has(canvasId)) return this._views.get(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas || !this.supported()) return null;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 2, 0.1, 500);

    // Content lives in a dedicated group so data updates never touch the
    // scene-level helpers (grid floor, lights).
    const content = new THREE.Group();
    scene.add(content);

    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(6, 12, 8);
    scene.add(key);

    const view = {
      id: canvasId, canvas, renderer, scene, camera, content,
      // Spherical camera state (custom orbit — see _bindOrbit)
      orbit: { theta: 0, phi: 1.12, radius: 17, target: new THREE.Vector3(0, 1.6, 0),
               minPhi: 0.35, maxPhi: 1.5, minR: 9, maxR: 30 },
      anim: [],          // per-frame callbacks (entrance animations)
      _t0: performance.now(),
    };
    this._bindOrbit(view);
    this._resize(view);
    new ResizeObserver(() => this._resize(view)).observe(canvas.parentElement || canvas);

    this._views.set(canvasId, view);
    this._start();
    return view;
  },

  _resize(view) {
    const el = view.canvas;
    const w = el.clientWidth || 400, h = el.clientHeight || 200;
    view.renderer.setSize(w, h, false);
    view.camera.aspect = w / h;
    view.camera.updateProjectionMatrix();
  },

  /** Minimal orbit controls: drag to rotate, wheel to zoom, clamped so the
   *  chart can never be spun into an unreadable angle. */
  _bindOrbit(view) {
    const o = view.orbit;
    let dragging = false, lx = 0, ly = 0;
    view.canvas.addEventListener('mousedown', e => {
      dragging = true; lx = e.clientX; ly = e.clientY;
      view.canvas.style.cursor = 'grabbing';
    });
    window.addEventListener('mouseup', () => {
      dragging = false; view.canvas.style.cursor = 'grab';
    });
    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      o.theta -= (e.clientX - lx) * 0.006;
      o.phi = Math.max(o.minPhi, Math.min(o.maxPhi, o.phi - (e.clientY - ly) * 0.005));
      lx = e.clientX; ly = e.clientY;
    });
    view.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      o.radius = Math.max(o.minR, Math.min(o.maxR, o.radius * (1 + e.deltaY * 0.0012)));
    }, { passive: false });
    view.canvas.addEventListener('dblclick', () => { o.theta = 0; o.phi = 1.12; });
    view.canvas.style.cursor = 'grab';
  },

  _updateCamera(view) {
    const o = view.orbit;
    const sp = Math.sin(o.phi), cp = Math.cos(o.phi);
    view.camera.position.set(
      o.target.x + o.radius * sp * Math.sin(o.theta),
      o.target.y + o.radius * cp,
      o.target.z + o.radius * sp * Math.cos(o.theta),
    );
    view.camera.lookAt(o.target);
  },

  // ── Shared render loop (skips hidden canvases) ──────────────────
  _start() {
    if (this._raf) return;
    const tick = () => {
      const now = performance.now();
      let anyVisible = false;
      this._views.forEach(view => {
        // offsetParent is null when the element (or an ancestor) is hidden —
        // this is what keeps inactive tabs from burning GPU.
        if (!view.canvas.offsetParent) return;
        anyVisible = true;
        const t = (now - view._t0) / 1000;
        view.anim = view.anim.filter(fn => fn(t) !== false);
        this._updateCamera(view);
        view.renderer.render(view.scene, view.camera);
      });
      this._raf = anyVisible || this._views.size ? requestAnimationFrame(tick) : null;
    };
    this._raf = requestAnimationFrame(tick);
  },

  /** Empty a view's content group, releasing GPU resources. */
  clear(view) {
    if (!view) return;
    view.anim = [];
    const dispose = obj => {
      obj.children.slice().forEach(dispose);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    };
    view.content.children.slice().forEach(child => { dispose(child); view.content.remove(child); });
    view._t0 = performance.now();
  },

  // ── Building blocks ─────────────────────────────────────────────
  /** Translucent solid + bright wireframe edges = the hologram look. */
  holoBox(w, h, d, color, opacity = 0.28) {
    const g = new THREE.Group();
    const geo = new THREE.BoxGeometry(w, h, d);
    g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color, transparent: true, opacity, roughness: 0.35, metalness: 0.1,
      emissive: color, emissiveIntensity: 0.25, depthWrite: false,
    })));
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })));
    return g;
  },

  /** Text as a camera-facing sprite (canvas texture). */
  label(text, { color = '#cfeaf2', size = 46, scale = 1 } = {}) {
    const pad = 8;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = `700 ${size}px Segoe UI, system-ui, sans-serif`;
    c.width = Math.ceil(ctx.measureText(text).width) + pad * 2;
    c.height = size + pad * 2;
    const ctx2 = c.getContext('2d');
    ctx2.font = `700 ${size}px Segoe UI, system-ui, sans-serif`;
    ctx2.fillStyle = color;
    ctx2.textBaseline = 'middle';
    ctx2.shadowColor = color; ctx2.shadowBlur = 12;
    ctx2.fillText(text, pad, c.height / 2);

    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    const k = 0.0075 * scale;
    sprite.scale.set(c.width * k, c.height * k, 1);
    return sprite;
  },

  /** Faint reference grid on the floor plane. */
  floor(view, width, depth) {
    const accent = this.accent();
    const grid = new THREE.GridHelper(Math.max(width, depth), 12, accent, accent);
    grid.material.transparent = true;
    grid.material.opacity = 0.13;
    grid.position.y = 0;
    view.content.add(grid);
    return grid;
  },

  // ── Charts ──────────────────────────────────────────────────────
  /**
   * 3D bar chart.
   * @param items [{ value, label, color?, highlight? }]
   * @param opts  { goal?, goalLabel?, unit?, maxHeight? }
   */
  bars(canvasId, items, opts = {}) {
    const view = this.view(canvasId);
    if (!view) return null;
    this.clear(view);
    if (!items.length) return view;

    const accent = this.accent();
    const H = opts.maxHeight || 6;
    const totalW = 13;
    const step = totalW / items.length;
    const bw = Math.min(step * 0.62, 1.1);
    const maxVal = Math.max(...items.map(i => i.value), opts.goal || 0, 1);

    view.orbit.target.set(0, H * 0.32, 0);
    this.floor(view, totalW + 3, 6);

    const grown = [];
    items.forEach((item, i) => {
      const x = -totalW / 2 + step * (i + 0.5);
      const h = Math.max((item.value / maxVal) * H, 0.02);
      const color = item.color ? new THREE.Color(item.color) : accent;
      const bar = this.holoBox(bw, h, bw, color, item.highlight ? 0.45 : 0.28);
      bar.position.set(x, h / 2, 0);
      bar.scale.y = 0.001;                     // grows in on entrance
      view.content.add(bar);
      grown.push({ bar, h });

      if (item.highlight) {
        const s = this.label(String(item.value), { color: '#' + color.getHexString(), size: 40, scale: 0.9 });
        s.position.set(x, h + 0.55, 0);
        view.content.add(s);
      }
    });

    // Goal reference plane
    if (opts.goal) {
      const gy = (opts.goal / maxVal) * H;
      const amber = this.colorOf('--amber', '#ffb03a');
      const geo = new THREE.PlaneGeometry(totalW + 1.4, 5.4);
      const plane = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: amber, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false,
      }));
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = gy;
      view.content.add(plane);

      const line = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: amber, transparent: true, opacity: 0.5 }));
      line.rotation.x = -Math.PI / 2;
      line.position.y = gy;
      view.content.add(line);

      const gl = this.label(opts.goalLabel || `meta ${opts.goal}`, { color: '#ffb03a', size: 34, scale: 0.85 });
      gl.position.set(totalW / 2 + 0.4, gy + 0.35, 0);
      view.content.add(gl);
    }

    // Entrance: bars rise with an ease-out over ~0.6s, staggered
    view.anim.push(t => {
      let running = false;
      grown.forEach((g, i) => {
        const local = Math.min(Math.max((t - i * 0.035) / 0.6, 0), 1);
        const e = 1 - Math.pow(1 - local, 3);
        g.bar.scale.y = Math.max(e, 0.001);
        g.bar.position.y = (g.h * g.bar.scale.y) / 2;
        if (local < 1) running = true;
      });
      return running;
    });
    return view;
  },

  /**
   * 3D line/ribbon chart (progression, weight trend).
   * @param series [{ value, label?, pr?, projected? }]
   * @param opts   { refs?: [{ value, label, color }] }
   */
  line(canvasId, series, opts = {}) {
    const view = this.view(canvasId);
    if (!view) return null;
    this.clear(view);
    if (series.length < 2) return view;

    const accent = this.accent();
    const H = 6, totalW = 13;
    const vals = series.map(s => s.value);
    const refVals = (opts.refs || []).map(r => r.value);
    const all = [...vals, ...refVals];
    const min = Math.min(...all) * 0.97, max = Math.max(...all) * 1.03;
    const span = (max - min) || 1;
    const X = i => -totalW / 2 + (i / (series.length - 1)) * totalW;
    const Y = v => ((v - min) / span) * H;

    view.orbit.target.set(0, H * 0.45, 0);
    this.floor(view, totalW + 3, 6);

    const pts = series.map((s, i) => new THREE.Vector3(X(i), Y(s.value), 0));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.3);

    // Thick glowing tube (Line width isn't reliable across platforms)
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.max(series.length * 12, 40), 0.075, 8, false),
      new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.7, roughness: 0.3 }));
    view.content.add(tube);

    // Translucent curtain from the curve down to the floor
    const dense = curve.getPoints(Math.max(series.length * 10, 40));
    const pos = [];
    for (let i = 0; i < dense.length - 1; i++) {
      const a = dense[i], b = dense[i + 1];
      pos.push(a.x, a.y, 0, b.x, b.y, 0, a.x, 0, 0);
      pos.push(b.x, b.y, 0, b.x, 0, 0, a.x, 0, 0);
    }
    const curtainGeo = new THREE.BufferGeometry();
    curtainGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    curtainGeo.computeVertexNormals();
    const curtain = new THREE.Mesh(curtainGeo, new THREE.MeshBasicMaterial({
      color: accent, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    view.content.add(curtain);

    // Data points — PRs get a bigger amber node
    const amber = this.colorOf('--amber', '#ffb03a');
    series.forEach((s, i) => {
      const isPR = !!s.pr;
      const c = isPR ? amber : accent;
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(isPR ? 0.19 : 0.11, 16, 12),
        new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9 }));
      dot.position.set(X(i), Y(s.value), 0);
      view.content.add(dot);
      if (isPR) {
        const halo = new THREE.Mesh(
          new THREE.RingGeometry(0.26, 0.34, 24),
          new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
        halo.position.copy(dot.position);
        view.content.add(halo);
      }
    });

    // Last value callout
    const last = series[series.length - 1];
    const lbl = this.label(String(last.value) + (opts.unit || ''), { color: '#' + accent.getHexString(), size: 44 });
    lbl.position.set(X(series.length - 1), Y(last.value) + 0.6, 0);
    view.content.add(lbl);

    // Horizontal reference planes (e.g. strength tier thresholds)
    (opts.refs || []).forEach(ref => {
      const y = Y(ref.value);
      if (y < -0.2 || y > H + 0.4) return;
      const col = ref.color ? new THREE.Color(ref.color) : accent;
      const geo = new THREE.PlaneGeometry(totalW + 1, 5);
      const line = new THREE.LineSegments(new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.32 }));
      line.rotation.x = -Math.PI / 2;
      line.position.y = y;
      view.content.add(line);
      if (ref.label) {
        const rl = this.label(ref.label, { color: '#' + col.getHexString(), size: 30, scale: 0.8 });
        rl.position.set(totalW / 2 + 0.5, y + 0.28, 0);
        view.content.add(rl);
      }
    });

    // Entrance: the curve draws itself in
    const totalDraw = tube.geometry.index ? tube.geometry.index.count : 0;
    if (totalDraw) {
      view.anim.push(t => {
        const p = Math.min(t / 0.9, 1);
        const e = 1 - Math.pow(1 - p, 3);
        tube.geometry.setDrawRange(0, Math.floor(totalDraw * e));
        return p < 1;
      });
    }
    return view;
  },

  /**
   * 3D adherence grid — rows of tiles standing on the floor.
   * @param rows [{ label, cells: [bool], color? }]
   */
  grid(canvasId, rows) {
    const view = this.view(canvasId);
    if (!view) return null;
    this.clear(view);
    if (!rows.length || !rows[0].cells.length) return view;

    const accent = this.accent();
    const cols = rows[0].cells.length;
    const totalW = 13, totalD = 4.2;
    const stepX = totalW / cols, stepZ = totalD / rows.length;
    const size = Math.min(stepX * 0.72, 0.72);

    view.orbit.target.set(0, 0.6, 0);
    view.orbit.phi = Math.min(view.orbit.phi, 1.05);
    this.floor(view, totalW + 3, totalD + 3);

    const tiles = [];
    rows.forEach((row, r) => {
      const z = -totalD / 2 + stepZ * (r + 0.5);
      const col = row.color ? new THREE.Color(row.color) : accent;
      row.cells.forEach((on, c) => {
        const x = -totalW / 2 + stepX * (c + 0.5);
        const h = on ? 0.5 : 0.06;
        const tile = this.holoBox(size, h, size, on ? col : new THREE.Color(0x3a5c68), on ? 0.42 : 0.12);
        tile.position.set(x, h / 2, z);
        tile.scale.y = 0.001;
        view.content.add(tile);
        tiles.push({ tile, h, delay: (c * 0.012) + (r * 0.06) });
      });
      const rl = this.label(row.label, { color: '#' + col.getHexString(), size: 32, scale: 0.8 });
      rl.position.set(-totalW / 2 - 0.9, 0.3, z);
      view.content.add(rl);
    });

    view.anim.push(t => {
      let running = false;
      tiles.forEach(o => {
        const p = Math.min(Math.max((t - o.delay) / 0.45, 0), 1);
        const e = 1 - Math.pow(1 - p, 3);
        o.tile.scale.y = Math.max(e, 0.001);
        o.tile.position.y = (o.h * o.tile.scale.y) / 2;
        if (p < 1) running = true;
      });
      return running;
    });
    return view;
  },

  /** Rebuild every live view after a theme change. */
  onThemeChange(rebuildFn) { this._rebuild = rebuildFn; },
};
