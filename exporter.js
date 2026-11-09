// Exporter glTF 2.0 sin librerias. Replica la estructura que genera Prisma3D:
// un buffer por cada bufferView (sin byteOffset), indices UNSIGNED_INT, POSITION con min/max,
// TEXCOORD_0, y dos canales (translation, rotation) con samplers LINEAR y tiempos propios.

function toBase64(typed) {
  const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function buildCone() {
  const A = [0, 0, -0.5];
  const B = [-0.2, -0.2, 0.2];
  const C = [0.2, -0.2, 0.2];
  const D = [0.2, 0.2, 0.2];
  const E = [-0.2, 0.2, 0.2];
  const center = [0, 0, 0.1];
  const tris = [[A, B, C], [A, C, D], [A, D, E], [A, E, B], [B, E, D], [B, D, C]];
  const pos = [], nor = [], uv = [], idx = [];
  tris.forEach((t) => {
    let [a, b, c] = t;
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const cen = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    const out = [cen[0] - center[0], cen[1] - center[1], cen[2] - center[2]];
    if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) {
      const tmp = b; b = c; c = tmp;
      n = [-n[0], -n[1], -n[2]];
    }
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    n = [n[0] / len, n[1] / len, n[2] / len];
    [a, b, c].forEach((p) => {
      idx.push(pos.length / 3);
      pos.push(p[0], p[1], p[2]);
      nor.push(n[0], n[1], n[2]);
      uv.push(p[0] + 0.5, p[1] + 0.5);
    });
  });
  return {
    pos: new Float32Array(pos),
    nor: new Float32Array(nor),
    uv: new Float32Array(uv),
    idx: new Uint32Array(idx)
  };
}

function minMax3(arr) {
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < arr.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (arr[i + k] < mn[k]) mn[k] = arr[i + k];
      if (arr[i + k] > mx[k]) mx[k] = arr[i + k];
    }
  }
  return { min: mn, max: mx };
}

export async function exportToGLTF(poses) {
  if (!poses || poses.length < 2) {
    throw new Error('Se necesitan al menos 2 poses para animar.');
  }

  // Tiempos estrictamente crecientes (en float32) y cuaterniones continuos y normalizados
  const clean = [];
  let lastT = -1;
  let prev = null;
  for (const p of poses) {
    const t = Math.fround(p.t - poses[0].t);
    if (!(t > lastT)) continue;
    lastT = t;
    let { x, y, z, w } = p.rot;
    const len = Math.hypot(x, y, z, w) || 1;
    x /= len; y /= len; z /= len; w /= len;
    if (prev && prev.x * x + prev.y * y + prev.z * z + prev.w * w < 0) {
      x = -x; y = -y; z = -z; w = -w;
    }
    prev = { x, y, z, w };
    clean.push({ t, pos: p.pos, rot: prev });
  }
  if (clean.length < 2) throw new Error('Las muestras no tienen tiempos distintos.');

  const count = clean.length;
  const times = new Float32Array(count);
  const trans = new Float32Array(count * 3);
  const rots = new Float32Array(count * 4);
  clean.forEach((p, i) => {
    times[i] = p.t;
    trans[i * 3] = p.pos.x; trans[i * 3 + 1] = p.pos.y; trans[i * 3 + 2] = p.pos.z;
    rots[i * 4] = p.rot.x; rots[i * 4 + 1] = p.rot.y; rots[i * 4 + 2] = p.rot.z; rots[i * 4 + 3] = p.rot.w;
  });

  const cone = buildCone();
  const mm = minMax3(cone.pos);
  const tMax = times[count - 1];

  // Orden identico al archivo de Prisma3D: 0 pos, 1 norm, 2 uv, 3 idx, 4 tiempos, 5 trans, 6 tiempos, 7 rot
  const data = [cone.pos, cone.nor, cone.uv, cone.idx, times, trans, times.slice(), rots];
  const targets = [34962, 34962, 34962, 34963, null, null, null, null];

  const gltf = {
    accessors: [
      { bufferView: 0, componentType: 5126, count: cone.pos.length / 3, max: mm.max, min: mm.min, type: 'VEC3' },
      { bufferView: 1, componentType: 5126, count: cone.nor.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: cone.uv.length / 2, type: 'VEC2' },
      { bufferView: 3, componentType: 5125, count: cone.idx.length, type: 'SCALAR' },
      { bufferView: 4, componentType: 5126, count: count, max: [tMax], min: [0], type: 'SCALAR' },
      { bufferView: 5, componentType: 5126, count: count, type: 'VEC3' },
      { bufferView: 6, componentType: 5126, count: count, max: [tMax], min: [0], type: 'SCALAR' },
      { bufferView: 7, componentType: 5126, count: count, type: 'VEC4' }
    ],
    animations: [
      {
        channels: [
          { sampler: 0, target: { node: 0, path: 'translation' } },
          { sampler: 1, target: { node: 0, path: 'rotation' } }
        ],
        name: 'Animation',
        samplers: [
          { input: 4, interpolation: 'LINEAR', output: 5 },
          { input: 6, interpolation: 'LINEAR', output: 7 }
        ]
      }
    ],
    asset: { generator: 'Camera Tracker PWA', version: '2.0' },
    bufferViews: data.map((d, i) => {
      const bv = { buffer: i, byteLength: d.byteLength };
      if (targets[i]) bv.target = targets[i];
      return bv;
    }),
    buffers: data.map((d) => ({
      byteLength: d.byteLength,
      uri: 'data:application/octet-stream;base64,' + toBase64(d)
    })),
    materials: [{ doubleSided: true, pbrMetallicRoughness: { metallicFactor: 0.0, roughnessFactor: 0.0 } }],
    meshes: [{ primitives: [{ attributes: { NORMAL: 1, POSITION: 0, TEXCOORD_0: 2 }, indices: 3, material: 0, mode: 4 }] }],
    nodes: [
      {
        mesh: 0,
        name: 'Camara',
        rotation: [clean[0].rot.x, clean[0].rot.y, clean[0].rot.z, clean[0].rot.w],
        scale: [1.0, 1.0, 1.0],
        translation: [clean[0].pos.x, clean[0].pos.y, clean[0].pos.z]
      }
    ],
    scenes: [{ nodes: [0] }]
  };

  return new Blob([JSON.stringify(gltf, null, 2)], { type: 'model/gltf+json' });
}
