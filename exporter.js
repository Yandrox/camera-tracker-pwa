import * as THREE from 'three';
import { GLTFExporter } from './lib/jsm/exporters/GLTFExporter.js';

export async function exportToGLTF(poses) {
  const scene = new THREE.Scene();

  // 1. Crear el cubo directamente (Malla pura, como en Prisma3D)
  const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  // Usamos MeshBasicMaterial para que no dependa de luces al importar
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); 
  const cube = new THREE.Mesh(geometry, material);
  cube.name = 'CameraCube'; // Nombre exacto para los canales

  // 2. Crear el cono indicador y hacerlo HIJO del cubo
  const coneGeo = new THREE.ConeGeometry(0.05, 0.15, 8);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0x0000ff });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  // Lo posicionamos al frente (-Z) y lo rotamos para que apunte hacia adelante
  cone.position.set(0, 0, -0.15);
  cone.rotation.x = -Math.PI / 2;
  
  cube.add(cone); // El cono hereda el movimiento del cubo
  scene.add(cube); // Añadimos el cubo a la escena

  // 3. Preparar los datos (Horneando cada frame, como Prisma3D)
  const times = poses.map(p => p.t);
  const posArr = poses.flatMap(p => [p.pos.x, p.pos.y, p.pos.z]);
  const rotArr = poses.flatMap(p => [p.rot.x, p.rot.y, p.rot.z, p.rot.w]);

  // 4. Crear los canales de Traslación y Rotación apuntando al CUBO
  const posTrack = new THREE.VectorKeyframeTrack('CameraCube.position', times, posArr);
  const rotTrack = new THREE.QuaternionKeyframeTrack('CameraCube.quaternion', times, rotArr);

  // 5. Crear el clip con la duración exacta (igual que el 2.16 del ejemplo)
  const duration = times.length > 0 ? times[times.length - 1] : 0;
  const clip = new THREE.AnimationClip('CameraMotion', duration, [posTrack, rotTrack]);

  // 6. Aplicar la primera pose al cubo para que no empiece en el origen (0,0,0)
  if (poses.length > 0) {
    cube.position.set(poses[0].pos.x, poses[0].pos.y, poses[0].pos.z);
    cube.quaternion.set(poses[0].rot.x, poses[0].rot.y, poses[0].rot.z, poses[0].rot.w);
  }

  // 7. Exportar
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => resolve(new Blob([result], { type: 'model/gltf-binary' })),
      reject,
      {
        binary: true,
        animations: [clip],
        trs: true // Forzar Traslación, Rotación y Escala (obligatorio para Prisma3D)
      }
    );
  });
}