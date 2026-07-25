'use strict';
// ════════════════════════════════════════════════════════════════
// Athlete — a holographic low-poly humanoid for the Gimnasio "ATLETA" panel.
//
// Rig (Groups are pivots, meshes are children offset from their pivot):
//   root → hips → torso(mesh, extends UP) → chestTop → { head,
//                    shoulder(L/R) → upperArm(mesh, hangs DOWN) → elbow →
//                      forearm(mesh, hangs DOWN) → hand → grip }
//          hips → thigh(L/R, mesh hangs DOWN) → knee → shin(mesh hangs DOWN) → foot
//
// Bone meshes are built with the standard THREE.CapsuleGeometry (Y-symmetric
// around its own origin) and shifted by ±length/2 depending on whether the
// bone extends UP from its pivot (torso, from the hips) or DOWN (every limb,
// from shoulder/hip/elbow/knee) — no rotation needed, since rotating a
// Y-symmetric capsule 180° around Z is a visual no-op.
//
// Every scalable/colorable part keeps a direct reference on the rig object
// (rig.thighMeshL, rig.matBody, ...) rather than searching `.children` by
// type — child-searching is fragile once a pivot holds both a joint sphere
// and a limb mesh (both are `mesh.isMesh === true`).
// ════════════════════════════════════════════════════════════════

const DEG2RAD = Math.PI / 180;
// Scratch vectors reused every frame — allocating Vector3s inside the
// animation loop would churn the GC at 60fps.
const _vHandL = new THREE.Vector3(), _vHandR = new THREE.Vector3(), _vMid = new THREE.Vector3();

const Athlete = {
  _rigs: new Map(), // canvasId -> rig

  // Proportions in the same arbitrary-but-consistent units Holo's other
  // charts use (a ~1.75-tall figure fits comfortably in that scale).
  // Torso is split pelvis/ribcage so it can taper into a real V-shape
  // instead of reading as one uniform tube.
  DIM: {
    shin: 0.45, thigh: 0.45,
    pelvis: 0.18, ribcage: 0.42,          // torso total 0.60
    neck: 0.115, headR: 0.125,            // long enough to clear the deltoids
    upperArm: 0.32, forearm: 0.30,
    // Hips wide enough that scaled-up thighs sit side by side instead of
    // merging into one column, while staying well under shoulder width.
    hipW: 0.27, shoulderW: 0.36,
    footLen: 0.23, footH: 0.055, footW: 0.095,
  },

  // Segment radii. Consecutive segments share the radius at the joint they
  // meet on, which is what makes the joints read as continuous.
  R: {
    hip: 0.15, waist: 0.125, chest: 0.195, neck: 0.055,
    upperArmTop: 0.078, upperArmBot: 0.058,
    forearmTop: 0.056, forearmBot: 0.042,
    thighTop: 0.118, thighBot: 0.082,
    shinTop: 0.078, shinBot: 0.048,
  },

  /**
   * A tapered limb/torso segment spanning y0→y1 in the parent's local space,
   * with radius r0 at y0 and r1 at y1. The end spheres use exactly the
   * cylinder's end radii, so where two segments meet (knee, elbow, waist)
   * the surfaces are tangent and the joint looks continuous — the previous
   * uniform-capsule + oversized-sphere approach is what made the figure read
   * as a stack of separate balls.
   */
  _seg(y0, y1, r0, r1, mat) {
    const g = new THREE.Group();
    const len = Math.abs(y1 - y0);
    const up = y1 > y0;
    // CylinderGeometry takes (radiusTop, radiusBottom) — top is the +Y end.
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(up ? r1 : r0, up ? r0 : r1, len, 18, 1), mat);
    cyl.position.y = (y0 + y1) / 2;
    g.add(cyl);
    const cap0 = new THREE.Mesh(new THREE.SphereGeometry(r0, 18, 12), mat);
    cap0.position.y = y0; g.add(cap0);
    const cap1 = new THREE.Mesh(new THREE.SphereGeometry(r1, 18, 12), mat);
    cap1.position.y = y1; g.add(cap1);
    return g;
  },

  /** Build the rig once for a Holo view. Call rig(view) instead in normal
   *  code — it builds lazily and returns the cached rig otherwise. */
  build(view, color) {
    const D = this.DIM, R = this.R;
    // Solid enough to read as a body. The original 0.55 opacity with
    // depthWrite:false let every internal surface show through, so overlapping
    // limbs blended into visual mush — the "hologram" feel comes from the
    // emissive glow and palette, not from being see-through.
    const matBody = new THREE.MeshStandardMaterial({
      color, transparent: true, opacity: 0.86, emissive: color, emissiveIntensity: 0.22,
      roughness: 0.42, metalness: 0.14,
    });
    const matJoint = new THREE.MeshStandardMaterial({
      color, transparent: true, opacity: 0.95, emissive: color, emissiveIntensity: 0.55,
      roughness: 0.25, metalness: 0.28,
    });

    const root = new THREE.Group();
    const hips = new THREE.Group();
    hips.position.y = D.shin + D.thigh;
    root.add(hips);

    // Torso pivots at the hips so a hinge rotates the whole upper body.
    const torso = new THREE.Group();
    hips.add(torso);
    const pelvisSeg = this._seg(0, D.pelvis, R.hip, R.waist, matBody);      // tapers in to the waist
    const ribSeg = this._seg(D.pelvis, D.pelvis + D.ribcage, R.waist, R.chest, matBody); // flares out to the chest
    torso.add(pelvisSeg, ribSeg);

    const chestTop = new THREE.Group();
    chestTop.position.y = D.pelvis + D.ribcage;
    torso.add(chestTop);

    const neckSeg = this._seg(0, D.neck, R.neck, R.neck, matBody);
    chestTop.add(neckSeg);
    const head = new THREE.Mesh(new THREE.SphereGeometry(D.headR, 20, 16), matJoint);
    head.position.y = D.neck + D.headR * 0.85;
    chestTop.add(head);

    const arms = {};
    [['L', -1], ['R', 1]].forEach(([side, sign]) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(sign * D.shoulderW / 2, -0.05, 0);
      chestTop.add(shoulder);
      // Deltoid cap — scaled by the shoulders score in setPhysique()
      const deltoid = new THREE.Mesh(new THREE.SphereGeometry(R.upperArmTop * 1.15, 18, 12), matBody);
      shoulder.add(deltoid);
      const upperSeg = this._seg(0, -D.upperArm, R.upperArmTop, R.upperArmBot, matBody);
      shoulder.add(upperSeg);

      const elbow = new THREE.Group();
      elbow.position.y = -D.upperArm;
      shoulder.add(elbow);
      const foreSeg = this._seg(0, -D.forearm, R.forearmTop, R.forearmBot, matBody);
      elbow.add(foreSeg);

      const hand = new THREE.Group();
      hand.position.y = -D.forearm;
      elbow.add(hand);

      arms[side] = { shoulder, elbow, hand, upperSeg, foreSeg, deltoid, sign };
    });

    const legs = {};
    [['L', -1], ['R', 1]].forEach(([side, sign]) => {
      const thigh = new THREE.Group();
      thigh.position.set(sign * D.hipW / 2, 0, 0);
      hips.add(thigh);
      const thighSeg = this._seg(0, -D.thigh, R.thighTop, R.thighBot, matBody);
      thigh.add(thighSeg);

      const knee = new THREE.Group();
      knee.position.y = -D.thigh;
      thigh.add(knee);
      const shinSeg = this._seg(0, -D.shin, R.shinTop, R.shinBot, matBody);
      knee.add(shinSeg);

      // Foot pivot sits at the ankle; animate() counter-rotates it so the
      // sole stays flat on the floor however the shin is angled.
      const foot = new THREE.Group();
      foot.position.y = -D.shin;
      knee.add(foot);
      const footMesh = new THREE.Mesh(new THREE.BoxGeometry(D.footW, D.footH, D.footLen), matBody);
      footMesh.position.set(0, -D.footH / 2, D.footLen / 2 - 0.05);
      foot.add(footMesh);

      legs[side] = { thigh, knee, foot, thighSeg, shinSeg, footMesh };
    });

    view.content.add(root);

    const rig = {
      root, hips, torso, pelvisSeg, ribSeg, chestTop, neckSeg, head, arms, legs,
      matBody, matJoint, color, barbell: null, physique: { legs: 0, back: 0, chest: 0, shoulders: 0, arms: 0 },
    };
    this._rigs.set(view.id, rig);
    return rig;
  },

  /** Get-or-build the rig for a view (color used only on first build). */
  rig(view, color) {
    return this._rigs.get(view.id) || this.build(view, color || (typeof Holo !== 'undefined' ? Holo.accent() : 0x35e2ff));
  },

  /** Recolor an existing rig in place (theme change) — avoids a full rebuild. */
  recolor(view, color) {
    const rig = this._rigs.get(view.id);
    if (!rig) return;
    rig.color = color;
    rig.matBody.color.copy(color); rig.matBody.emissive.copy(color);
    rig.matJoint.color.copy(color); rig.matJoint.emissive.copy(color);
  },

  /** Scale body-part radii per muscle-group score (0..1 each). Range is
   *  intentionally modest (×1.0 .. ×1.9) so Bronce reads lean and Diamante
   *  reads powerful without turning into a caricature. */
  setPhysique(view, scores) {
    const rig = this.rig(view);
    rig.physique = scores;
    const scaleOf = v => 1 + Math.max(0, Math.min(1, v || 0)) * 0.9;

    const legS = scaleOf(scores.legs);
    ['L', 'R'].forEach(side => {
      const leg = rig.legs[side];
      leg.thighSeg.scale.set(legS, 1, legS);
      leg.shinSeg.scale.set(1 + (legS - 1) * 0.6, 1, 1 + (legS - 1) * 0.6); // calves grow less than quads
      // Spread the hips as the quads thicken, otherwise the two thighs
      // intersect and the legs read as a single column.
      const sign = side === 'L' ? -1 : 1;
      leg.thigh.position.x = sign * (this.DIM.hipW / 2) * (1 + (legS - 1) * 0.5);
    });

    // Chest widens the ribcage laterally, back thickens it front-to-back —
    // so a deadlift-heavy athlete reads thick from the side, a bench-heavy
    // one reads wide from the front.
    const chestS = scaleOf(scores.chest), backS = scaleOf(scores.back);
    rig.ribSeg.scale.set(chestS, 1, backS);
    rig.pelvisSeg.scale.set(1 + (backS - 1) * 0.35, 1, 1 + (backS - 1) * 0.35);

    const shoulderS = scaleOf(scores.shoulders);
    const armS = scaleOf(scores.arms);
    ['L', 'R'].forEach(side => {
      const arm = rig.arms[side];
      // scaleOf() already returns the final multiplier (1..1.9); an earlier
      // version wrapped it again as `1 + shoulderS * 0.55`, pushing the
      // deltoids to ~2x and making the figure read as a pile of balls.
      arm.deltoid.scale.setScalar(shoulderS);
      arm.upperSeg.scale.set(armS, 1, armS);
      arm.foreSeg.scale.set(1 + (armS - 1) * 0.75, 1, 1 + (armS - 1) * 0.75);
      // Broader shoulders push the arms outward so they don't clip the ribcage.
      arm.shoulder.position.x = arm.sign * (this.DIM.shoulderW / 2) * (1 + (shoulderS - 1) * 0.4);
    });
  },

  /** Build/replace the barbell (real bar + IWF plates) held at the grip.
   *  Only the barbell subgroup is disposed/rebuilt — the rig itself is untouched. */
  setWeight(view, totalKg, sex) {
    const rig = this.rig(view);
    if (rig.barbell) {
      rig.root.remove(rig.barbell);
      rig.barbell.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    }
    const load = (typeof Strength !== 'undefined')
      ? Strength.plateLoad(totalKg, sex)
      : { barKg: 20, perSide: [], totalKg: 20, achievable: true };

    const group = new THREE.Group();
    const barLen = 1.1;
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, barLen, 12),
      new THREE.MeshStandardMaterial({ color: 0xbfc4c8, metalness: 0.6, roughness: 0.35 }));
    bar.rotation.z = Math.PI / 2;
    group.add(bar);

    const THICK = { 25: 0.045, 20: 0.04, 15: 0.035, 10: 0.03, 5: 0.022, 2.5: 0.016, 1.25: 0.012 };
    const RAD   = { 25: 0.22, 20: 0.20, 15: 0.18, 10: 0.15, 5: 0.11, 2.5: 0.09, 1.25: 0.07 };
    const plateDefs = (typeof Strength !== 'undefined') ? Strength.PLATES : [];
    const colorOf = kg => (plateDefs.find(p => p.kg === kg) || {}).color || '#888888';

    [-1, 1].forEach(sign => {
      let x = sign * (barLen / 2 - 0.06);
      load.perSide.forEach(kg => {
        const t = THICK[kg] || 0.02, r = RAD[kg] || 0.12;
        x += sign * (t / 2);
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, t, 20), new THREE.MeshStandardMaterial({
          color: colorOf(kg), metalness: 0.25, roughness: 0.5, transparent: true, opacity: 0.92,
        }));
        mesh.rotation.z = Math.PI / 2;
        mesh.position.x = x;
        x += sign * (t / 2);
        group.add(mesh);
      });
    });

    // Parented to root (not to a chest-relative grip pivot) so animate() can
    // place it exactly at the hands' world position each frame.
    rig.root.add(group);
    rig.barbell = group;
    return load;
  },

  // ── Per-exercise animation ──────────────────────────────────────
  // Smooth perpetual 0→1→0 oscillation — the sine itself provides the
  // ease-in/out, no easing curve needed on top.
  _phase(t, periodSec) { return (Math.sin((t / periodSec) * Math.PI * 2 - Math.PI / 2) + 1) / 2; },

  /**
   * Two-segment leg IK: given a hip height, find the thigh/knee rotations
   * that keep the foot planted on the floor with the knee tracking forward.
   * Law of cosines on the hip–knee–foot triangle:
   *     cos(alpha) = (h^2 + a^2 - b^2) / (2·h·a)
   * Solving this instead of hand-tuning angles is what actually keeps the
   * feet on the ground — eyeballed rotations sank the foot ~0.07 units
   * below the floor at the bottom of the squat.
   */
  _legIK(hipY) {
    const a = this.DIM.thigh, b = this.DIM.shin;
    const h = Math.max(0.05, Math.min(hipY, a + b - 1e-4)); // clamp to reachable
    const cosA = Math.max(-1, Math.min(1, (h * h + a * a - b * b) / (2 * h * a)));
    const alpha = Math.acos(cosA);                    // thigh angle off vertical
    const thighRot = -alpha;                          // negative => knee travels forward (+Z)
    const shinWorld = Math.atan2(a * Math.sin(alpha), h - a * Math.cos(alpha));
    // shinWorld is also what the foot must counter-rotate by to stay flat.
    return { thighRot, kneeRot: shinWorld - thighRot, shinWorld };
  },

  /**
   * Apply one exercise's pose for a given elapsed time. Every pose parameter
   * is computed exactly once per call as a single flat set of locals, then
   * applied — composing this from several independent if/else blocks let a
   * later block silently clobber an earlier one's value for a shared joint.
   *
   * The rig only knows how to stand, so all four lifts are stylized as
   * standing movements (bench becomes a standing press-out) rather than
   * adding a lying-down pose that would reorient the whole figure — jarring
   * when switching tabs mid-orbit.
   *
   * The barbell is NOT posed independently: after the joints are set, it's
   * snapped to the midpoint of the two hands in world space. Animating a
   * chest-relative grip pivot separately from the arms left the bar floating
   * 0.26–0.45 units away from the hands in every single pose.
   */
  animate(view, liftId, t) {
    const rig = this._rigs.get(view.id);
    if (!rig) return;
    const D = this.DIM;
    const restHipY = D.shin + D.thigh;

    let hipY = restHipY, torsoX = 0;
    let shoulderX = 0, shoulderZ = 0, elbowX = 0;  // shoulderZ = abduction (arms out sideways)
    let barZ = 0, barY = 0;                        // extra bar offset from the hands

    if (liftId === 'squat') {
      const p = this._phase(t, 2.4);
      hipY = restHipY - p * 0.30;
      torsoX = p * 12 * DEG2RAD;        // slight forward lean under load
      shoulderZ = 78 * DEG2RAD;         // arms out to the sides, bar across the traps
      barZ = -0.13;                     // sit the bar behind the neck, not through it
    } else if (liftId === 'bench') {
      const p = this._phase(t, 1.9);    // 0 = racked at chest, 1 = locked out
      torsoX = -8 * DEG2RAD;
      shoulderX = -92 * DEG2RAD;        // arms forward, horizontal
      elbowX = -(1 - p) * 78 * DEG2RAD; // bend deep at the chest, straight at lockout
    } else if (liftId === 'deadlift') {
      const p = this._phase(t, 2.4);    // 0 = bent over the bar, 1 = locked out
      torsoX = (1 - p) * 62 * DEG2RAD;
      hipY = restHipY - (1 - p) * 0.14; // hips ride slightly lower off the floor
      // Arms just hang — as the torso hinges, the shoulders (and so the hands,
      // and so the bar) travel down with it. Anatomically correct for free.
    } else if (liftId === 'ohp') {
      const p = this._phase(t, 2.0);    // 0 = racked at shoulders, 1 = overhead
      shoulderX = -(18 + p * 158) * DEG2RAD;
      elbowX = -(1 - p) * 72 * DEG2RAD;
    }

    // Legs: solved so the feet stay planted for whatever hip height the lift wants
    const ik = this._legIK(hipY);
    rig.hips.position.y = hipY;
    rig.torso.rotation.x = torsoX;
    ['L', 'R'].forEach(side => {
      rig.legs[side].thigh.rotation.x = ik.thighRot;
      rig.legs[side].knee.rotation.x = ik.kneeRot;
      // Keep the sole flat on the floor regardless of shin angle
      rig.legs[side].foot.rotation.x = -ik.shinWorld;
      const arm = rig.arms[side];
      arm.shoulder.rotation.x = shoulderX;
      arm.shoulder.rotation.z = shoulderZ * arm.sign; // mirror abduction per side
      arm.elbow.rotation.x = elbowX;
    });

    // Snap the bar into the hands (world space), then convert back to root-local.
    if (rig.barbell) {
      rig.root.updateWorldMatrix(true, true);
      rig.arms.L.hand.getWorldPosition(_vHandL);
      rig.arms.R.hand.getWorldPosition(_vHandR);
      _vMid.copy(_vHandL).add(_vHandR).multiplyScalar(0.5);
      rig.root.worldToLocal(_vMid);
      rig.barbell.position.set(_vMid.x, _vMid.y + barY, _vMid.z + barZ);
    }
  },

  /** Full teardown (rarely needed — Holo already skips hidden canvases and
   *  the rig is cheap to keep around; exposed for completeness/testing). */
  dispose(view) {
    const rig = this._rigs.get(view.id);
    if (!rig) return;
    rig.root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    if (view.content) view.content.remove(rig.root);
    this._rigs.delete(view.id);
  },
};
