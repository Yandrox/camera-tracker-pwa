import * as THREE from 'three';
import { GLTFExporter } from './lib/jsm/exporters/GLTFExporter.js';

export async function exportToGLTF(poses) {
  const scene = new THREE.Scene();
  
  // 1. Crear la cámara con el nombre exacto que usaremos en las pistas
  const cam = new THREE.PerspectiveCamera(60, 1, 0.01, 1000);
  cam.name = 'TrackedCamera';
  scene.add(cam);

  // 2. Extraer los tiempos y valores de las poses
  const times = poses.map(p => p.t);
  const posArr = poses.flatMap(p => [p.pos.x, p.pos.y, p.pos.z]);
  const rotArr = poses.flatMap(p => [p.rot.x, p.rot.y, p.rot.z, p.rot.w]);

  // 3. Crear las pistas. Es CRÍTICO que el nombre incluya el objeto.
  const posTrack = new THREE.VectorKeyframeTrack('TrackedCamera.position', times, posArr);
  const rotTrack = new THREE.QuaternionKeyframeTrack('TrackedCamera.quaternion', times, rotArr);

  // 4. Crear el clip de animación
  const clip = new THREE.AnimationClip('CameraTrack', -1, [posTrack, rotTrack]);

  // 5. Exportar pasando el clip directamente en las opciones
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
        animations: [clip] // Aquí se le dice al exportador qué animación incluir
      }
    );
  });
}