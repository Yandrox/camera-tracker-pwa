import * as THREE from 'three';
import { GLTFExporter } from './lib/jsm/exporters/GLTFExporter.js';

export async function exportToGLTF(poses) {
  const scene = new THREE.Scene();
  
  // 1. Crear un cubo pequeño y visible
  const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  // Color verde neón para que sea fácil de identificar en Prisma3D
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); 
  const cube = new THREE.Mesh(geometry, material);
  
  // El nombre debe coincidir EXACTAMENTE con el de las pistas de animación
  cube.name = 'CameraCube'; 
  scene.add(cube);

  // 2. Extraer los tiempos y valores de las poses
  const times = poses.map(p => p.t);
  const posArr = poses.flatMap(p => [p.pos.x, p.pos.y, p.pos.z]);
  const rotArr = poses.flatMap(p => [p.rot.x, p.rot.y, p.rot.z, p.rot.w]);

  // 3. Crear las pistas vinculadas al CUBO (no a la cámara)
  const posTrack = new THREE.VectorKeyframeTrack('CameraCube.position', times, posArr);
  const rotTrack = new THREE.QuaternionKeyframeTrack('CameraCube.quaternion', times, rotArr);

  // 4. Crear el clip de animación
  const clip = new THREE.AnimationClip('CubeTrack', -1, [posTrack, rotTrack]);

  // 5. Exportar pasando el clip directamente
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => resolve(new Blob([result], { type: 'model/gltf-binary' })),
      (error) => {
        console.error('Error en GLTFExporter:', error);
        reject(error);
      },
      {
        binary: true,
        animations: [clip] 
      }
    );
  });
}