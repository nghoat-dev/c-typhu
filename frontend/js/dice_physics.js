// Hai viên xúc xắc 3D màu trắng ngà bo góc, chấm đen rõ nét — tung và nảy trực tiếp vào lòng trung tâm bàn cờ.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TOP_Y } from './biome_gen.js';
import { sfx } from './audio.js';

const SIZE = 0.72;
const HALF = SIZE / 2;
const ARENA_Y = 0.035; // khớp mặt thảm cỏ trung tâm (GRASS_Y = 0.03)

const FACE_ORDER = [2, 5, 1, 6, 3, 4];
const FACE_NORMALS = {
  1: new THREE.Vector3(0, 1, 0),
  6: new THREE.Vector3(0, -1, 0),
  2: new THREE.Vector3(1, 0, 0),
  5: new THREE.Vector3(-1, 0, 0),
  3: new THREE.Vector3(0, 0, 1),
  4: new THREE.Vector3(0, 0, -1),
};

const PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.26, 0.26], [0.74, 0.26], [0.5, 0.5], [0.26, 0.74], [0.74, 0.74]],
  6: [[0.28, 0.23], [0.72, 0.23], [0.28, 0.5], [0.72, 0.5], [0.28, 0.77], [0.72, 0.77]],
};

function makeRoundedCubeGeo(size, radius = 0.085, segs = 6) {
  const geo = new THREE.BoxGeometry(size, size, size, segs, segs, segs);
  const pos = geo.attributes.position;
  const inner = size / 2 - radius;
  const v = new THREE.Vector3();
  const clamped = new THREE.Vector3();
  const dir = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    clamped.set(
      THREE.MathUtils.clamp(v.x, -inner, inner),
      THREE.MathUtils.clamp(v.y, -inner, inner),
      THREE.MathUtils.clamp(v.z, -inner, inner),
    );
    dir.subVectors(v, clamped);
    if (dir.lengthSq() > 1e-6) {
      dir.normalize().multiplyScalar(radius);
      v.copy(clamped).add(dir);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function makeFaceMat(val) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');

  // Trắng tinh sắc nét, không ngả xám
  const grad = g.createRadialGradient(116, 108, 12, 128, 128, 180);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#f4f6fa');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);

  // Chấm đen rõ nét (viên 1 to hơn một chút)
  const r = val === 1 ? 28 : 21;
  for (const [px, py] of PIPS[val]) {
    const cx = px * 256, cy = py * 256;
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.beginPath(); g.arc(cx + 2, cy + 3, r + 1, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0f172a';
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.beginPath(); g.arc(cx - r * 0.25, cy - r * 0.25, r * 0.24, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.28, metalness: 0.0 });
}

function quatBetweenFaces(fromVal, toVal) {
  const u = FACE_NORMALS[fromVal];
  const v = FACE_NORMALS[toVal];
  const dot = u.dot(v);
  if (dot > 0.999) return new THREE.Quaternion();
  if (dot < -0.999) {
    const axis = Math.abs(u.y) > 0.5 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    return new THREE.Quaternion().setFromAxisAngle(axis, Math.PI);
  }
  return new THREE.Quaternion().setFromUnitVectors(u, v);
}

function topFace(q) {
  let bestVal = 1, bestY = -Infinity;
  const tmp = new THREE.Vector3();
  for (let v = 1; v <= 6; v++) {
    tmp.copy(FACE_NORMALS[v]).applyQuaternion(q);
    if (tmp.y > bestY) { bestY = tmp.y; bestVal = v; }
  }
  return { val: bestVal, dot: bestY };
}

export class DiceRoller {
  constructor(parentGroup) {
    this.group = new THREE.Group();
    parentGroup.add(this.group);

    const mats = FACE_ORDER.map(makeFaceMat);
    const geo = makeRoundedCubeGeo(SIZE, 0.085, 6);
    this.meshes = [0, 1].map(() => {
      const m = new THREE.Mesh(geo, mats);
      m.castShadow = true;
      m.receiveShadow = true;
      m.visible = false;
      this.group.add(m);
      return m;
    });
    this.ripples = [];

    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -34, 0) });
    this.dieMat = new CANNON.Material('die');
    this.floorMat = new CANNON.Material('floor');
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.dieMat, this.floorMat, {
      friction: 0.45, restitution: 0.46,
    }));
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.dieMat, this.dieMat, {
      friction: 0.35, restitution: 0.52,
    }));

    const floor = new CANNON.Body({ mass: 0, material: this.floorMat, shape: new CANNON.Plane() });
    floor.position.set(0, ARENA_Y, 0);
    floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(floor);

    const walls = [
      { pos: [3.2, ARENA_Y + 2, 0], euler: [0, -Math.PI / 2, 0] },
      { pos: [-3.2, ARENA_Y + 2, 0], euler: [0, Math.PI / 2, 0] },
      { pos: [0, ARENA_Y + 2, 3.2], euler: [0, Math.PI, 0] },
      { pos: [0, ARENA_Y + 2, -3.2], euler: [0, 0, 0] },
    ];
    for (const w of walls) {
      const b = new CANNON.Body({ mass: 0, material: this.floorMat, shape: new CANNON.Plane() });
      b.position.set(...w.pos);
      b.quaternion.setFromEuler(...w.euler);
      this.world.addBody(b);
    }

    const boxShape = new CANNON.Box(new CANNON.Vec3(HALF, HALF, HALF));
    this.bodies = [0, 1].map(() => {
      const b = new CANNON.Body({
        mass: 1, shape: boxShape, material: this.dieMat,
        linearDamping: 0.16, angularDamping: 0.18,
      });
      this.world.addBody(b);
      return b;
    });

    this.playback = null;
  }

  _spawnRipple(x, z, strength = 1) {
    const r = new THREE.Mesh(
      new THREE.RingGeometry(0.24, 0.38, 24),
      new THREE.MeshBasicMaterial({ color: '#ffae34', transparent: true, opacity: 0.8 * strength, side: THREE.DoubleSide }),
    );
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, ARENA_Y + 0.02, z);
    this.group.add(r);
    this.ripples.push({ mesh: r, t: 0 });
  }

  simulate(d1, d2) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 1.65;
      const sx = Math.cos(angle) * r, sz = Math.sin(angle) * r;
      const dirX = -Math.cos(angle), dirZ = -Math.sin(angle);

      this.bodies.forEach((b, i) => {
        const side = i === 0 ? -0.58 : 0.58;
        b.position.set(sx + -dirZ * side, ARENA_Y + 3.0 + i * 0.35, sz + dirX * side);
        b.velocity.set(dirX * (3.0 + Math.random() * 1.6) + (Math.random() - 0.5),
          -1.6 - Math.random() * 1.2,
          dirZ * (3.0 + Math.random() * 1.6) + (Math.random() - 0.5));
        b.angularVelocity.set(
          (Math.random() - 0.5) * 24,
          (Math.random() - 0.5) * 24,
          (Math.random() - 0.5) * 24,
        );
        b.quaternion.setFromEuler(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        b.wakeUp();
      });

      const frames = [];
      let prevVy = [0, 0];
      for (let step = 0; step < 160; step++) {
        this.world.step(1 / 60);
        const f = {
          p1: new THREE.Vector3(this.bodies[0].position.x, this.bodies[0].position.y, this.bodies[0].position.z),
          q1: new THREE.Quaternion(this.bodies[0].quaternion.x, this.bodies[0].quaternion.y, this.bodies[0].quaternion.z, this.bodies[0].quaternion.w),
          p2: new THREE.Vector3(this.bodies[1].position.x, this.bodies[1].position.y, this.bodies[1].position.z),
          q2: new THREE.Quaternion(this.bodies[1].quaternion.x, this.bodies[1].quaternion.y, this.bodies[1].quaternion.z, this.bodies[1].quaternion.w),
          bounce: 0,
          bouncePos: null,
        };
        for (let i = 0; i < 2; i++) {
          const vy = this.bodies[i].velocity.y;
          if (prevVy[i] < -0.9 && vy > 0.35) {
            f.bounce = Math.max(f.bounce, Math.min(1, Math.abs(prevVy[i]) / 6));
            f.bouncePos = { x: this.bodies[i].position.x, z: this.bodies[i].position.z };
          }
          prevVy[i] = vy;
        }
        frames.push(f);
        if (step > 45) {
          const v1 = this.bodies[0].velocity.lengthSquared() + this.bodies[0].angularVelocity.lengthSquared();
          const v2 = this.bodies[1].velocity.lengthSquared() + this.bodies[1].angularVelocity.lengthSquared();
          if (v1 < 0.015 && v2 < 0.015) break;
        }
      }

      const last = frames[frames.length - 1];
      const top1 = topFace(last.q1);
      const top2 = topFace(last.q2);
      if (top1.dot > 0.92 && top2.dot > 0.92) {
        return { frames, off1: quatBetweenFaces(d1, top1.val), off2: quatBetweenFaces(d2, top2.val) };
      }
    }
    return {
      frames: [{ p1: new THREE.Vector3(-0.6, ARENA_Y + HALF, 0), q1: new THREE.Quaternion(),
        p2: new THREE.Vector3(0.6, ARENA_Y + HALF, 0), q2: new THREE.Quaternion(), bounce: 1, bouncePos: { x: 0, z: 0 } }],
      off1: quatBetweenFaces(d1, 1), off2: quatBetweenFaces(d2, 1),
    };
  }

  roll([d1, d2]) {
    const sim = this.simulate(d1, d2);
    this.meshes.forEach(m => { m.visible = true; });
    sfx.shake();
    return new Promise((resolve) => {
      this.playback = { ...sim, idx: 0, acc: 0, lastBounceIdx: -10, done: resolve };
    });
  }

  update(dt) {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rp = this.ripples[i];
      rp.t += dt * 2.5;
      const s = 1 + rp.t * 2.4;
      rp.mesh.scale.set(s, s, 1);
      rp.mesh.material.opacity = Math.max(0, 0.8 * (1 - rp.t));
      if (rp.t >= 1) { this.group.remove(rp.mesh); this.ripples.splice(i, 1); }
    }

    const pb = this.playback;
    if (!pb) return;

    pb.acc += dt * 68;
    const targetIdx = Math.min(pb.frames.length - 1, Math.floor(pb.acc));
    for (let i = pb.idx; i <= targetIdx; i++) {
      const f = pb.frames[i];
      if (f.bounce > 0 && i - pb.lastBounceIdx > 4) {
        sfx.dice(f.bounce);
        if (f.bouncePos) this._spawnRipple(f.bouncePos.x, f.bouncePos.z, f.bounce);
        pb.lastBounceIdx = i;
      }
    }
    pb.idx = targetIdx;
    const f = pb.frames[targetIdx];
    this.meshes[0].position.copy(f.p1);
    this.meshes[0].quaternion.copy(f.q1).multiply(pb.off1);
    this.meshes[1].position.copy(f.p2);
    this.meshes[1].quaternion.copy(f.q2).multiply(pb.off2);

    if (targetIdx >= pb.frames.length - 1) {
      const done = pb.done;
      this.playback = null;
      setTimeout(done, 260);
    }
  }

  focusPoint() {
    if (!this.playback) return null;
    return this.meshes[0].position.clone().add(this.meshes[1].position).multiplyScalar(0.5);
  }

  hide() {
    this.meshes.forEach(m => { m.visible = false; });
  }
}
