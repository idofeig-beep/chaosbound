// =====================================================================
// CHAOSBOUND: simple, reliable collision world (axis-aligned boxes + vertical cylinders + terrain)
// Bodies are vertical capsules described by feet position, radius and height.
// =====================================================================
import { THREE, V3, clamp } from './core.js';

export class World {
  constructor(groundH = () => 0) {
    this.groundH = groundH;   // terrain height function
    this.boxes = [];          // {min, max, wall}
    this.cyls = [];           // {x, z, r, y0, y1}
    this.bounds = null;       // {type:'circle', r} or {type:'rect', x0,x1,z0,z1}
  }
  // box from center-x, bottom-y, center-z and size
  box(cx, y0, cz, sx, sy, sz, wall = true) {
    const b = { min: V3(cx - sx / 2, y0, cz - sz / 2), max: V3(cx + sx / 2, y0 + sy, cz + sz / 2), wall };
    this.boxes.push(b); return b;
  }
  cyl(x, z, r, y0 = -5, y1 = 50) { const c = { x, z, r, y0, y1 }; this.cyls.push(c); return c; }

  // highest walkable surface under (x,z) that is not above y+step
  groundAt(x, z, y = 1e9, step = 0.55) {
    let g = this.groundH(x, z);
    for (const b of this.boxes) {
      if (x >= b.min.x - 0.05 && x <= b.max.x + 0.05 && z >= b.min.z - 0.05 && z <= b.max.z + 0.05 && b.max.y <= y + step && b.max.y > g) g = b.max.y;
    }
    for (const c of this.cyls) {
      if (c.y1 < 30 && c.y1 <= y + step && c.y1 > g && Math.hypot(x - c.x, z - c.z) < c.r) g = c.y1;
    }
    return g;
  }
  // push a body out of walls; returns the last wall normal touched (or null)
  collide(p, rad, h, step = 0.55) {
    let wall = null;
    for (const b of this.boxes) {
      if (b.max.y <= p.y + step || b.min.y >= p.y + h) continue;
      const cx = clamp(p.x, b.min.x, b.max.x), cz = clamp(p.z, b.min.z, b.max.z);
      let dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
      if (d >= rad) continue;
      if (d > 1e-5) { dx /= d; dz /= d; p.x += dx * (rad - d); p.z += dz * (rad - d); }
      else {
        const ex = [p.x - b.min.x, b.max.x - p.x, p.z - b.min.z, b.max.z - p.z], m = Math.min(...ex), i = ex.indexOf(m);
        dx = i === 0 ? -1 : i === 1 ? 1 : 0; dz = i === 2 ? -1 : i === 3 ? 1 : 0;
        p.x += dx * (m + rad); p.z += dz * (m + rad);
      }
      if (b.wall) wall = V3(dx, 0, dz);
    }
    for (const c of this.cyls) {
      if (c.y1 <= p.y + step || c.y0 >= p.y + h) continue;
      let dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + rad;
      if (d >= m || d < 1e-5) continue;
      dx /= d; dz /= d; p.x = c.x + dx * m; p.z = c.z + dz * m; wall = V3(dx, 0, dz);
    }
    const B = this.bounds;
    if (B) {
      if (B.type === 'circle') { const d = Math.hypot(p.x, p.z); if (d > B.r) { p.x *= B.r / d; p.z *= B.r / d; wall = V3(-p.x / B.r, 0, -p.z / B.r); } }
      else { p.x = clamp(p.x, B.x0 + rad, B.x1 - rad); p.z = clamp(p.z, B.z0 + rad, B.z1 - rad); }
    }
    return wall;
  }
  // is a point inside solid geometry? (projectiles)
  solid(p) {
    if (p.y < this.groundH(p.x, p.z)) return true;
    for (const b of this.boxes) if (p.x > b.min.x && p.x < b.max.x && p.y > b.min.y && p.y < b.max.y && p.z > b.min.z && p.z < b.max.z) return true;
    for (const c of this.cyls) if (p.y > c.y0 && p.y < c.y1 && Math.hypot(p.x - c.x, p.z - c.z) < c.r) return true;
    return false;
  }
  // line of sight test by stepping
  los(a, b, step = 0.6) {
    const d = b.clone().sub(a), L = d.length(), n = Math.ceil(L / step); d.divideScalar(n);
    const p = a.clone();
    for (let i = 1; i < n; i++) { p.add(d); if (this.solid(p)) return false; }
    return true;
  }
}
