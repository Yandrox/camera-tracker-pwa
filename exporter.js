export async function exportToGLTF(poses) {
  // 1. Definir la geometría del cono manualmente (apuntando hacia -Z)
  // Usamos 24 vértices (8 triángulos) para que el archivo sea pequeño y limpio.
  const posiciones = new Float32Array([
    // Lateral 1
    0, 0, -0.2,  -0.1, -0.1, 0,   0.1, -0.1, 0,
    // Lateral 2
    0, 0, -0.2,   0.1, -0.1, 0,   0.1,  0.1, 0,
    // Lateral 3
    0, 0, -0.2,   0.1,  0.1, 0,  -0.1,  0.1, 0,
    // Lateral 4
    0, 0, -0.2,  -0.1,  0.1, 0,  -0.1, -0.1, 0,
    // Base 1
    -0.1, -0.1, 0,   0, 0, 0,   0.1, -0.1, 0,
    // Base 2
    0.1, -0.1, 0,   0, 0, 0,   0.1,  0.1, 0,
    // Base 3
    0.1,  0.1, 0,   0, 0, 0,  -0.1,  0.1, 0,
    // Base 4
    -0.1,  0.1, 0,   0, 0, 0,  -0.1, -0.1, 0
  ]);

  // Normales aproximadas para que el motor 3D sepa cómo iluminar
  const normales = new Float32Array([
    0, 0.894, 0.447,  0, 0.894, 0.447,  0, 0.894, 0.447,
    0.894, 0, 0.447,  0.894, 0, 0.447,  0.894, 0, 0.447,
    0, -0.894, 0.447,  0, -0.894, 0.447,  0, -0.894, 0.447,
    -0.894, 0, 0.447, -0.894, 0, 0.447, -0.894, 0, 0.447,
    0, 0, 1,  0, 0, 1,  0, 0, 1,
    0, 0, 1,  0, 0, 1,  0, 0, 1,
    0, 0, 1,  0, 0, 1,  0, 0, 1,
    0, 0, 1,  0, 0, 1,  0, 0, 1
  ]);

  // Índices (conectan los vértices en triángulos)
  const indices = new Uint16Array([
    0, 1, 2,  3, 4, 5,  6, 7, 8,  9, 10, 11,
    12, 13, 14,  15, 16, 17,  18, 19, 20,  21, 22, 23
  ]);

  // 2. Preparar los datos de la animación
  const times = new Float32Array(poses.map(p => p.t));
  const trans = new Float32Array(poses.length * 3);
  const rots = new Float32Array(poses.length * 4);
  
  poses.forEach((p, i) => {
    trans[i * 3] = p.pos.x;
    trans[i * 3 + 1] = p.pos.y;
    trans[i * 3 + 2] = p.pos.z;
    rots[i * 4] = p.rot.x;
    rots[i * 4 + 1] = p.rot.y;
    rots[i * 4 + 2] = p.rot.z;
    rots[i * 4 + 3] = p.rot.w;
  });

  // 3. Empaquetar todo en un solo Array binario (en el mismo orden que los bufferViews)
  const buffers = [times, trans, rots, posiciones, normales, indices];
  let totalLength = 0;
  buffers.forEach(b => { totalLength += b.byteLength; });

  const combined = new Uint8Array(totalLength);
  let offset = 0;
  const bufferViews = [];
  
  buffers.forEach((b, i) => {
    combined.set(new Uint8Array(b.buffer), offset);
    let target;
    if (i === 3 || i === 4) target = 34962; // ARRAY_BUFFER (Vértices y normales)
    if (i === 5) target = 34963;             // ELEMENT_ARRAY_BUFFER (Índices)
    
    const bv = { buffer: 0, byteOffset: offset, byteLength: b.byteLength };
    if (target) bv.target = target;
    bufferViews.push(bv);
    
    offset += b.byteLength;
    // Alineación a 4 bytes (requisito de glTF)
    while (offset % 4 !== 0) { offset++; totalLength++; }
  });

  // Convertir el binario a Base64
  const combinedFull = new Uint8Array(totalLength);
  combinedFull.set(combined);
  let binary = '';
  for (let i = 0; i < combinedFull.length; i++) {
    binary += String.fromCharCode(combinedFull[i]);
  }
  const base64 = btoa(binary);

  // 4. Construir el JSON con la MISMA estructura exacta que Prisma3D
  const gltf = {
    asset: { version: "2.0", generator: "Camera Tracker PWA" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      {
        name: "ConoCamara",
        mesh: 0,
        translation: [poses[0].pos.x, poses[0].pos.y, poses[0].pos.z],
        rotation: [poses[0].rot.x, poses[0].rot.y, poses[0].rot.z, poses[0].rot.w],
        scale: [1, 1, 1]
      }
    ],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 3, NORMAL: 4 },
            indices: 5,
            material: 0,
            mode: 4
          }
        ]
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
    animations: [
      {
        name: "Animation",
        channels: [
          { sampler: 0, target: { node: 0, path: "translation" } },
          { sampler: 1, target: { node: 0, path: "rotation" } }
        ],
        samplers: [
          { input: 0, output: 1, interpolation: "LINEAR" },
          { input: 2, output: 1, interpolation: "LINEAR" } // Reutilizamos los tiempos del input 0
        ]
      }
    ],
    bufferViews: bufferViews,
    accessors: [
      { bufferView: 0, componentType: 5126, count: poses.length, type: "SCALAR", max: [times[times.length - 1]], min: [times[0]] }, // Tiempos (input 0)
      { bufferView: 1, componentType: 5126, count: poses.length, type: "VEC3" }, // Traslación (output 1)
      { bufferView: 2, componentType: 5126, count: poses.length, type: "VEC4" }, // Rotación (output 2)
      { bufferView: 3, componentType: 5126, count: 24, type: "VEC3" }, // Posición
      { bufferView: 4, componentType: 5126, count: 24, type: "VEC3" }, // Normal
      { bufferView: 5, componentType: 5123, count: 24, type: "SCALAR" } // Índices
    ],
    buffers: [
      {
        byteLength: totalLength,
        uri: "data:application/octet-stream;base64," + base64
      }
    ]
  };

  const jsonStr = JSON.stringify(gltf, null, 2);
  return new Blob([jsonStr], { type: 'model/gltf+json' });
}