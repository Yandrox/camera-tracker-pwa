export async function exportToGLTF(poses) {
  if (!poses || poses.length < 2) {
    throw new Error("Se necesitan al menos 2 poses para animar.");
  }

  // 1. Geometría simple del cono (apuntando hacia -Z)
  const pos = new Float32Array([
    0, 0, -0.5,       // 0: Punta
    -0.2, -0.2, 0.2,  // 1: Base
    0.2, -0.2, 0.2,   // 2: Base
    0.2, 0.2, 0.2,    // 3: Base
    -0.2, 0.2, 0.2    // 4: Base
  ]);
  const norm = new Float32Array([
    0, 0, -1,
    -0.5, -0.5, 0.7,
    0.5, -0.5, 0.7,
    0.5, 0.5, 0.7,
    -0.5, 0.5, 0.7
  ]);
  const idx = new Uint16Array([
    0, 1, 2,  0, 2, 3,  0, 3, 4,  0, 4, 1, // Lados
    1, 4, 3,  1, 3, 2                      // Base
  ]);

  // 2. Extraer los datos reales de la animación
  const count = poses.length;
  const times = new Float32Array(poses.map(p => p.t));
  const trans = new Float32Array(count * 3);
  const rots = new Float32Array(count * 4);

  poses.forEach((p, i) => {
    trans[i*3] = p.pos.x;
    trans[i*3+1] = p.pos.y;
    trans[i*3+2] = p.pos.z;
    rots[i*4] = p.rot.x;
    rots[i*4+1] = p.rot.y;
    rots[i*4+2] = p.rot.z;
    rots[i*4+3] = p.rot.w;
  });

  // 3. Calcular los offsets exactos y alinear a 4 bytes correctamente
  let offset = pos.byteLength;
  while (offset % 4 !== 0) offset++;
  const offsetNorm = offset;

  offset += norm.byteLength;
  while (offset % 4 !== 0) offset++;
  const offsetIdx = offset;

  offset += idx.byteLength;
  while (offset % 4 !== 0) offset++;
  const offsetTimes = offset;

  offset += times.byteLength;
  while (offset % 4 !== 0) offset++;
  const offsetTrans = offset;

  offset += trans.byteLength;
  while (offset % 4 !== 0) offset++;
  const offsetRots = offset;

  const totalSize = offsetRots + rots.byteLength;

  // 4. Crear el buffer binario y escribir cada dato en su posición exacta
  const buffer = new ArrayBuffer(totalSize);
  new Uint8Array(buffer, 0, pos.byteLength).set(new Uint8Array(pos.buffer));
  new Uint8Array(buffer, offsetNorm, norm.byteLength).set(new Uint8Array(norm.buffer));
  new Uint8Array(buffer, offsetIdx, idx.byteLength).set(new Uint8Array(idx.buffer));
  new Uint8Array(buffer, offsetTimes, times.byteLength).set(new Uint8Array(times.buffer));
  new Uint8Array(buffer, offsetTrans, trans.byteLength).set(new Uint8Array(trans.buffer));
  new Uint8Array(buffer, offsetRots, rots.byteLength).set(new Uint8Array(rots.buffer));

  // 5. Convertir a Base64 de forma segura
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  // 6. Ensamblar el JSON (Estructura exacta de Prisma3D)
  const gltf = {
    accessors: [
      { bufferView: 0, componentType: 5126, count: 5, type: "VEC3" }, // Pos
      { bufferView: 1, componentType: 5126, count: 5, type: "VEC3" }, // Norm
      { bufferView: 2, componentType: 5123, count: 18, type: "SCALAR" }, // Idx
      { bufferView: 3, componentType: 5126, count: count, type: "SCALAR", max: [times[count-1]], min: [times[0]] }, // Times (Input 3)
      { bufferView: 4, componentType: 5126, count: count, type: "VEC3" }, // Trans (Output 4)
      { bufferView: 3, componentType: 5126, count: count, type: "SCALAR", max: [times[count-1]], min: [times[0]] }, // Times 2 (Input 5)
      { bufferView: 5, componentType: 5126, count: count, type: "VEC4" }  // Rots (Output 6)
    ],
    animations: [
      {
        channels: [
          { sampler: 0, target: { node: 0, path: "translation" } },
          { sampler: 1, target: { node: 0, path: "rotation" } }
        ],
        name: "Animation",
        samplers: [
          { input: 3, interpolation: "LINEAR", output: 4 },
          { input: 5, interpolation: "LINEAR", output: 6 }
        ]
      }
    ],
    asset: { generator: "Camera Tracker PWA", version: "2.0" },
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: pos.byteLength, target: 34962 },
      { buffer: 0, byteOffset: offsetNorm, byteLength: norm.byteLength, target: 34962 },
      { buffer: 0, byteOffset: offsetIdx, byteLength: idx.byteLength, target: 34963 },
      { buffer: 0, byteOffset: offsetTimes, byteLength: times.byteLength },
      { buffer: 0, byteOffset: offsetTrans, byteLength: trans.byteLength },
      { buffer: 0, byteOffset: offsetRots, byteLength: rots.byteLength }
    ],
    buffers: [
      { byteLength: totalSize, uri: "data:application/octet-stream;base64," + base64 }
    ],
    materials: [
      {
        doubleSided: true,
        pbrMetallicRoughness: { baseColorFactor: [0, 0, 1, 1], metallicFactor: 0.0, roughnessFactor: 0.0 }
      }
    ],
    meshes: [
      {
        primitives: [{ attributes: { NORMAL: 1, POSITION: 0 }, indices: 2, material: 0, mode: 4 }]
      }
    ],
    nodes: [
      {
        mesh: 0,
        name: "ConoCamara",
        rotation: [poses[0].rot.x, poses[0].rot.y, poses[0].rot.z, poses[0].rot.w],
        scale: [1.0, 1.0, 1.0],
        translation: [poses[0].pos.x, poses[0].pos.y, poses[0].pos.z]
      }
    ],
    scenes: [{ nodes: [0] }]
  };

  return new Blob([JSON.stringify(gltf, null, 2)], { type: 'model/gltf+json' });
}