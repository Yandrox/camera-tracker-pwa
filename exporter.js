export async function exportToGLTF(poses) {
  // 1. Geometría del cono (5 vértices, 6 triángulos) apuntando hacia -Z
  const posiciones = new Float32Array([
    0, 0, -0.2,       // 0: Punta
    -0.1, -0.1, 0,    // 1: Base inf izq
    0.1, -0.1, 0,     // 2: Base inf der
    0.1, 0.1, 0,      // 3: Base sup der
    -0.1, 0.1, 0      // 4: Base sup izq
  ]);

  const normales = new Float32Array([
    0, 0, -1,          // 0
    -0.707, -0.707, 0.707, // 1
    0.707, -0.707, 0.707,  // 2
    0.707, 0.707, 0.707,   // 3
    -0.707, 0.707, 0.707   // 4
  ]);

  const indices = new Uint16Array([
    0, 1, 2,  0, 2, 3,  0, 3, 4,  0, 4, 1, // Caras laterales
    1, 4, 3,  1, 3, 2                      // Base
  ]);

  // 2. Datos de la animación
  const count = poses.length;
  const tiempos = new Float32Array(poses.map(p => p.t));
  const traslacion = new Float32Array(count * 3);
  const rotacion = new Float32Array(count * 4);

  poses.forEach((p, i) => {
    traslacion[i * 3] = p.pos.x;
    traslacion[i * 3 + 1] = p.pos.y;
    traslacion[i * 3 + 2] = p.pos.z;
    rotacion[i * 4] = p.rot.x;
    rotacion[i * 4 + 1] = p.rot.y;
    rotacion[i * 4 + 2] = p.rot.z;
    rotacion[i * 4 + 3] = p.rot.w;
  });

  // 3. Empaquetar todo en un solo buffer (estándar glTF)
  const dataArrays = [posiciones, normales, indices, tiempos, traslacion, tiempos, rotacion];
  let totalBytes = 0;
  dataArrays.forEach(arr => { totalBytes += arr.byteLength; });
  
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  const bufferViews = [];

  dataArrays.forEach((arr) => {
    combined.set(new Uint8Array(arr.buffer), offset);
    
    // Alineación a 4 bytes
    while (offset % 4 !== 0) { offset++; }
    
    bufferViews.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: arr.byteLength
    });
    offset += arr.byteLength;
  });

  // Convertir a Base64
  let binary = '';
  for (let i = 0; i < combined.length; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  const base64 = btoa(binary);

  // 4. Construir el JSON idéntico a Prisma3D
  const gltf = {
    accessors: [
      { bufferView: 0, componentType: 5126, count: 5, type: "VEC3" }, // Posiciones
      { bufferView: 1, componentType: 5126, count: 5, type: "VEC3" }, // Normales
      { bufferView: 2, componentType: 5123, count: 18, type: "SCALAR" }, // Índices
      { bufferView: 3, componentType: 5126, count: count, type: "SCALAR", max: [tiempos[count - 1]], min: [tiempos[0]] }, // Tiempos
      { bufferView: 4, componentType: 5126, count: count, type: "VEC3" }, // Traslación
      { bufferView: 5, componentType: 5126, count: count, type: "SCALAR", max: [tiempos[count - 1]], min: [tiempos[0]] }, // Tiempos 2
      { bufferView: 6, componentType: 5126, count: count, type: "VEC4" }  // Rotación
    ],
    animations: [
      {
        channels: [
          { sampler: 0, target: { node: 0, path: "translation" } },
          { sampler: 1, target: { node: 0, path: "rotation" } }
        ],
        name: "Animation",
        samplers: [
          { input: 3, interpolation: "LINEAR", output: 4 }, // Usa accessor 3 (tiempos) y 4 (traslación)
          { input: 5, interpolation: "LINEAR", output: 6 }  // Usa accessor 5 (tiempos) y 6 (rotación)
        ]
      }
    ],
    asset: {
      generator: "Camera Tracker PWA",
      version: "2.0"
    },
    bufferViews: bufferViews,
    buffers: [
      {
        byteLength: combined.length,
        uri: "data:application/octet-stream;base64," + base64
      }
    ],
    materials: [
      {
        doubleSided: true,
        pbrMetallicRoughness: {
          baseColorFactor: [0, 0, 1, 1], // Azul
          metallicFactor: 0.0,
          roughnessFactor: 0.0
        }
      }
    ],
    meshes: [
      {
        primitives: [
          {
            attributes: { NORMAL: 1, POSITION: 0 },
            indices: 2,
            material: 0,
            mode: 4
          }
        ]
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