import * as THREE from 'three';

export async function exportToGLTF(poses) {
  // 1. Obtener la geometría de un cubo y un cono
  const boxGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const coneGeo = new THREE.ConeGeometry(0.05, 0.15, 8);

  // 2. Preparar los datos de la animación (horneados)
  const times = new Float32Array(poses.map(p => p.t));
  const trans = new Float32Array(poses.length * 3);
  const rots = new Float32Array(poses.length * 4);
  poses.forEach((p, i) => {
    trans[i*3] = p.pos.x; trans[i*3+1] = p.pos.y; trans[i*3+2] = p.pos.z;
    rots[i*4] = p.rot.x; rots[i*4+1] = p.rot.y; rots[i*4+2] = p.rot.z; rots[i*4+3] = p.rot.w;
  });

  // 3. Función auxiliar para empaquetar los datos en el buffer (base64)
  const parts = [];
  let byteOffset = 0;
  const bufferViews = [];
  const accessors = [];

  function addBufferView(data, target) {
    while (byteOffset % 4 !== 0) { parts.push(new Uint8Array(1)); byteOffset++; }
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    parts.push(bytes);
    const bv = { buffer: 0, byteOffset, byteLength: bytes.byteLength };
    if (target) bv.target = target;
    bufferViews.push(bv);
    byteOffset += bytes.byteLength;
    return bufferViews.length - 1;
  }

  function addAccessor(bufferView, componentType, count, type, max, min) {
    const acc = { bufferView, componentType, count, type };
    if (max) acc.max = max;
    if (min) acc.min = min;
    accessors.push(acc);
    return accessors.length - 1;
  }

  // Geometría del Cubo
  const accCubePos = addAccessor(addBufferView(boxGeo.attributes.position.array, 34962), 5126, 24, "VEC3");
  const accCubeNorm = addAccessor(addBufferView(boxGeo.attributes.normal.array, 34962), 5126, 24, "VEC3");
  const accCubeIdx = addAccessor(addBufferView(new Uint16Array(boxGeo.index.array), 34963), 5123, 36, "SCALAR");

  // Geometría del Cono
  const accConePos = addAccessor(addBufferView(coneGeo.attributes.position.array, 34962), 5126, coneGeo.attributes.position.count, "VEC3");
  const accConeNorm = addAccessor(addBufferView(coneGeo.attributes.normal.array, 34962), 5126, coneGeo.attributes.normal.count, "VEC3");
  const accConeIdx = addAccessor(addBufferView(new Uint16Array(coneGeo.index.array), 34963), 5123, coneGeo.index.count, "SCALAR");

  // Animación (Tiempos, Traslación, Rotación)
  const accTimes = addAccessor(addBufferView(times), 5126, times.length, "SCALAR", [times[times.length-1]], [0]);
  const accTrans = addAccessor(addBufferView(trans), 5126, poses.length, "VEC3");
  const accRots = addAccessor(addBufferView(rots), 5126, poses.length, "VEC4");

  // Unir todo el binario y pasarlo a Base64
  const combined = new Uint8Array(byteOffset);
  let offset = 0;
  for (const part of parts) { combined.set(part, offset); offset += part.byteLength; }
  let binary = '';
  for (let i = 0; i < combined.length; i += 8192) {
    binary += String.fromCharCode.apply(null, combined.subarray(i, i + 8192));
  }
  const base64 = btoa(binary);

  // 4. Ensamblar el JSON EXACTO (Cubo animado, cono hijo)
  const gltf = {
    asset: { version: "2.0", generator: "Camera Tracker PWA" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      {
        name: "CameraCube",
        mesh: 0,
        translation: [poses[0].pos.x, poses[0].pos.y, poses[0].pos.z],
        rotation: [poses[0].rot.x, poses[0].rot.y, poses[0].rot.z, poses[0].rot.w],
        scale: [1, 1, 1],
        children: [1] // El cono está dentro del cubo
      },
      {
        name: "Cone",
        mesh: 1,
        translation: [0, 0, -0.15],
        rotation: [-0.70710678, 0, 0, 0.70710678], // Apunta hacia adelante (-Z)
        scale: [1, 1, 1]
      }
    ],
    meshes: [
      { primitives: [{ attributes: { POSITION: accCubePos, NORMAL: accCubeNorm }, indices: accCubeIdx, material: 0, mode: 4 }] },
      { primitives: [{ attributes: { POSITION: accConePos, NORMAL: accConeNorm }, indices: accConeIdx, material: 1, mode: 4 }] }
    ],
    materials: [
      { doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [1, 0, 0, 1], metallicFactor: 0.0, roughnessFactor: 0.0 } }, // Rojo
      { doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [0, 0, 1, 1], metallicFactor: 0.0, roughnessFactor: 0.0 } }  // Azul
    ],
    animations: [
      {
        name: "Animation",
        channels: [
          { sampler: 0, target: { node: 0, path: "translation" } },
          { sampler: 1, target: { node: 0, path: "rotation" } }
        ],
        samplers: [
          { input: accTimes, output: accTrans, interpolation: "LINEAR" },
          { input: accTimes, output: accRots, interpolation: "LINEAR" }
        ]
      }
    ],
    bufferViews: bufferViews,
    accessors: accessors,
    buffers: [{ byteLength: byteOffset, uri: "data:application/octet-stream;base64," + base64 }]
  };

  // 5. Devolver el archivo como .gltf (Texto JSON)
  const jsonStr = JSON.stringify(gltf, null, 2);
  return new Blob([jsonStr], { type: 'model/gltf+json' });
}