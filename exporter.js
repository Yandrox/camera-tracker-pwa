import * as THREE from 'three';
import { GLTFExporter } from './lib/jsm/exporters/GLTFExporter.js';

export async function exportToGLTF(poses) {
  const scene = new THREE.Scene();

  // Añadimos una luz para que el cubo se vea bien en cualquier motor
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(1, 1, 1);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  // 1. Crear el cubo (el "cuerpo" de la cámara)
  const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
  const cube = new THREE.Mesh(geometry, material);
  cube.name = 'CameraCube'; // Nombre exacto para las pistas

  // 2. Añadir un cono rojo para indicar hacia dónde mira la cámara
  const coneGeo = new THREE.ConeGeometry(0.05, 0.15, 8);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  // En Three.js, la cámara mira hacia -Z. Colocamos el cono delante y lo rotamos.
  cone.position.set(0, 0, -0.15);
  cone.rotation.x = -Math.PI / 2;
  cube.add(cone);

  // 3. Añadir la cámara real como hija del cubo
  const cam = new THREE.PerspectiveCamera(60, 1, 0.01, 1000);
  cam.name = 'TrackedCamera';
  cube.add(cam); // La cámara heredará el movimiento del cubo

  scene.add(cube);

  // 4. Extraer los tiempos y valores de las poses
  const times = poses.map(p => p.t);
  const posArr = poses.flatMap(p => [p.pos.x, p.pos.y, p.pos.z]);
  const rotArr = poses.flatMap(p => [p.rot.x, p.rot.y, p.rot.z, p.rot.w]);

  // 5. Crear las pistas vinculadas al CUBO
  const posTrack = new THREE.VectorKeyframeTrack('CameraCube.position', times, posArr);
  const rotTrack = new THREE.QuaternionKeyframeTrack('CameraCube.quaternion', times, rotArr);

  // 6. Crear el clip de animación
  const clip = new THREE.AnimationClip('CameraTrack', -1, [posTrack, rotTrack]);

  // 7. Exportar
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