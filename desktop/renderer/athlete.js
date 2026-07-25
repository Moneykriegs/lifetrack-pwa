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

const Athlete = {
  _rigs: new Map(), // canvasId -> rig

  // Proportions in the same arbitrary-but-consistent units Holo's other
  // charts use (a ~1.7-tall figure fits comfortably in that scale).
  DIM: { shin: 0.45, thigh: 0.45, torso: 0.6, neckHead: 0.13, upperArm: 0.32, forearm: 0.30, hipW: 0.22, shoulderW: 0.34 },

  // A bone mesh: a capsule anchored to its pivot at y=0, extending either
  // up (dir=+1, used only for the torso) or down (dir=-1, every limb).
  _bone(length, radius, mat, dir) {
    const geo = new THREE.CapsuleGeometry(radius, Math.max(length - radius * 2, 0.02), 6, 10);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = dir * length / 2;
    return mesh;
  },
  _joint(radius, mat) { return new THREE.Mesh(new THREE.SphereGeometry(radius, 14, 10), mat); },

  /** Build the rig once for a Holo view. Call rig(view) instead in normal
   *  code — it builds lazily and returns the cached rig otherwise. */
  build(view, color) {
    const D = this.DIM;
    const matBody = new THREE.MeshStandardMaterial({
      color, transparent: true, opacity: 0.55, emissive: color, emissiveIntensity: 0.3,
      roughness: 0.45, metalness: 0.12, depthWrite: false,
    });
    const matJoint = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.3,
    });

    const root = new THREE.Group();
    const hips = new THREE.Group();
    hips.position.y = D.shin + D.thigh;
    root.add(hips);
    hips.add(this._joint(0.09, matJoint));

    const torso = new THREE.Group();
    hips.add(torso);
    const torsoMesh = this._bone(D.torso, 0.16, matBody, +1);
    torso.add(torsoMesh);

    const chestTop = new THREE.Group();
    chestTop.position.y = D.torso;
    torso.add(chestTop);

    const head = this._joint(0.13, matJoint);
    head.position.y = D.neckHead + 0.13;
    chestTop.add(head);

    const arms = {};
    [['L', -1], ['R', 1]].forEach(([side, sign]) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(sign * D.shoulderW / 2, 0.02, 0);
      chestTop.add(shoulder);
      shoulder.add(this._joint(0.07, matJoint));
      const upperArmMesh = this._bone(D.upperArm, 0.065, matBody, -1);
      shoulder.add(upperArmMesh);

      const elbow = new THREE.Group();
      elbow.position.y = -D.upperArm;
      shoulder.add(elbow);
      elbow.add(this._joint(0.055, matJoint));
      const forearmMesh = this._bone(D.forearm, 0.055, matBody, -1);
      elbow.add(forearmMesh);

      const hand = new THREE.Group();
      hand.position.y = -D.forearm;
      elbow.add(hand);

      arms[side] = { shoulder, elbow, hand, upperArmMesh, forearmMesh };
    });

    const legs = {};
    [['L', -1], ['R', 1]].forEach(([side, sign]) => {
      const thigh = new THREE.Group();
      thigh.position.set(sign * D.hipW / 2, 0, 0);
      hips.add(thigh);
      thigh.add(this._joint(0.075, matJoint));
      const thighMesh = this._bone(D.thigh, 0.1, matBody, -1);
      thigh.add(thighMesh);

      const knee = new THREE.Group();
      knee.position.y = -D.thigh;
      thigh.add(knee);
      knee.add(this._joint(0.06, matJoint));
      const shinMesh = this._bone(D.shin, 0.075, matBody, -1);
      knee.add(shinMesh);

      const foot = new THREE.Group();
      foot.position.y = -D.shin;
      knee.add(foot);

      legs[side] = { thigh, knee, foot, thighMesh, shinMesh };
    });

    // Grip pivot for the barbell — roughly where both hands meet when
    // holding a bar in front of / above the body; exercise poses move this.
    const grip = new THREE.Group();
    grip.position.set(0, -D.forearm - 0.05, 0.08);
    chestTop.add(grip);

    view.content.add(root);

    const rig = {
      root, hips, torso, torsoMesh, chestTop, head, arms, legs, grip,
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
      rig.legs[side].thighMesh.scale.set(legS, 1, legS);
      rig.legs[side].shinMesh.scale.set(legS * 0.92, 1, legS * 0.92);
    });

    const torsoS = scaleOf((scores.back + scores.chest) / 2);
    rig.torsoMesh.scale.set(torsoS, 1, torsoS * 0.9);

    const shoulderS = scaleOf(scores.shoulders);
    const armS = scaleOf(scores.arms);
    ['L', 'R'].forEach(side => {
      // Shoulder joint sphere reads deltoid size; arm capsules read biceps/triceps.
      rig.arms[side].shoulder.children[0].scale.setScalar(1 + shoulderS * 0.55);
      rig.arms[side].upperArmMesh.scale.set(armS, 1, armS);
      rig.arms[side].forearmMesh.scale.set(armS * 0.9, 1, armS * 0.9);
    });
  },

  /** Build/replace the barbell (real bar + IWF plates) held at the grip.
   *  Only the barbell subgroup is disposed/rebuilt — the rig itself is untouched. */
  setWeight(view, totalKg, sex) {
    const rig = this.rig(view);
    if (rig.barbell) {
      rig.grip.remove(rig.barbell);
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

    rig.grip.add(group);
    rig.barbell = group;
    return load;
  },

  // ── Per-exercise animation ──────────────────────────────────────
  // Smooth perpetual 0→1→0 oscillation — the sine itself provides the
  // ease-in/out, no easing curve needed on top.
  _phase(t, periodSec) { return (Math.sin((t / periodSec) * Math.PI * 2 - Math.PI / 2) + 1) / 2; },

  /**
   * Apply one exercise's pose for a given elapsed time. Every pose
   * parameter (hip height, torso lean, thigh/knee/shoulder/elbow flex, grip
   * position) is computed exactly once per call as a single flat set of
   * local variables, then applied — an earlier draft composed this from
   * several independent if/else blocks and a later block could silently
   * clobber an earlier one's value for the same joint when switching lifts.
   * A single branch with full pose parameters per case avoids that class
   * of bug entirely.
   *
   * The rig only knows how to stand, so all four lifts are stylized as
   * standing movements (bench becomes a standing press-out) rather than
   * adding a lying-down pose that would reorient the whole figure —
   * jarring when switching tabs mid-orbit, and this keeps one consistent
   * silhouette to inspect from any angle.
   */
  animate(view, liftId, t) {
    const rig = this._rigs.get(view.id);
    if (!rig) return;
    const D = this.DIM;
    const restHipY = D.shin + D.thigh;
    const restGripY = -D.forearm - 0.05, restGripZ = 0.08;

    let hipY = restHipY, torsoX = 0;
    let thighX = 0, kneeX = 0;        // symmetric across L/R
    let shoulderX = 0, elbowX = 0;    // symmetric across L/R
    let gripY = restGripY, gripZ = restGripZ;

    if (liftId === 'squat') {
      const p = this._phase(t, 2.4);
      hipY = restHipY - p * 0.14;
      thighX = p * 32 * DEG2RAD;
      kneeX = -p * 34 * DEG2RAD;
      torsoX = p * 8 * DEG2RAD; // slight forward lean under load
    } else if (liftId === 'bench') {
      const p = this._phase(t, 1.9); // 0 = bar racked at chest, 1 = arms locked out
      torsoX = -10 * DEG2RAD;
      shoulderX = -20 * DEG2RAD;
      elbowX = -(1 - p) * 70 * DEG2RAD;
      gripY = restGripY + p * 0.10;
      gripZ = restGripZ + 0.05 + p * 0.25;
    } else if (liftId === 'deadlift') {
      const p = this._phase(t, 2.4); // 0 = hinged over near the floor, 1 = locked out standing
      torsoX = (1 - p) * 55 * DEG2RAD;
      gripY = restGripY - (1 - p) * 0.30;
      gripZ = restGripZ + 0.20;
    } else if (liftId === 'ohp') {
      const p = this._phase(t, 2.0); // 0 = racked at shoulders, 1 = overhead lockout
      shoulderX = -p * 165 * DEG2RAD;
      elbowX = -p * 15 * DEG2RAD;
      gripY = restGripY + p * 0.55;
      gripZ = restGripZ - p * 0.12;
    }

    rig.hips.position.y = hipY;
    rig.torso.rotation.x = torsoX;
    ['L', 'R'].forEach(side => {
      rig.legs[side].thigh.rotation.x = thighX;
      rig.legs[side].knee.rotation.x = kneeX;
      rig.arms[side].shoulder.rotation.x = shoulderX;
      rig.arms[side].elbow.rotation.x = elbowX;
    });
    rig.grip.position.set(0, gripY, gripZ);
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
