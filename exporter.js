import * as THREE from 'three';
import { GLTFExporter } from './lib/jsm/exporters/GLTFExporter.js';

export async function exportToGLTF(poses) {
  const scene = new THREE.Scene();

  // 1. Crear el cubo (Cuerpo de la cámara)
  const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  // MeshBasicMaterial no necesita luces, se ve siempre
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Rojo
  const cube = new THREE.Mesh(geometry, material);
  cube.name = 'CameraCube'; // Nombre exacto para la animación

  // 2. Crear un cono para indicar hacia dónde mira la cámara (hacia el -Z)
  const coneGeo = new THREE.ConeGeometry(0.05, 0.15, 8);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0x0000ff }); // Azul
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.set(0, 0, -0.15); // Lo ponemos al frente
  cone.rotation.x = -Math.PI / 2; // Lo giramos para que apunte hacia adelante
  
  // Añadimos el cono DENTRO del cubo para que se muevan juntos
  cube.add(cone);
  scene.add(cube);

  // 3. Preparar los datos de la animación
  const times = poses.map(p => p.t);
  const posArr = poses.flatMap(p => [p.pos.x, p.pos.y, p.pos.z]);
  const rotArr = poses.flatMap(p => [p.rot.x, p.rot.y, p.rot.z, p.rot.w]);

  // 4. Crear las pistas vinculadas al cubo
  const posTrack = new THREE.VectorKeyframeTrack('CameraCube.position', times, posArr);
  const rotTrack = new THREE.QuaternionKeyframeTrack('CameraCube.quaternion', times, rotArr);

  const clip = new THREE.AnimationClip('CameraTrack', -1, [posTrack, rotTrack]);

  // 5. Colocar el cubo en la primera posición para que se vea al importar
  if (poses.length > 0) {
    cube.position.set(poses[0].pos.x, poses[0].pos.y, poses[0].pos.z);
    cube.quaternion.set(poses[0].rot.x, poses[0].rot.y, poses[0].rot.z, poses[0].rot.w);
  }

  // 6. Exportar
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => resolve(new Blob([result], { type: 'model/gltf-binary' })),
      reject,
      { binary: true, animations: [clip] }
    );
  });
}