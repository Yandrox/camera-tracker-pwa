import * as THREE from 'three';
import { GLTFExporter } from './lib/jsm/exporters/GLTFExporter.js';

export async function exportToGLTF(poses) {
  const scene = new THREE.Scene();

  // 1. Crear el nodo contenedor (rig) que recibirá la animación
  const rig = new THREE.Group();
  rig.name = 'CameraRig'; // Nombre exacto para las pistas

  // 2. Crear el cubo y el cono y añadirlos AL RIG
  const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Rojo visible
  const cube = new THREE.Mesh(geometry, material);
  cube.name = 'CameraCube';

  const coneGeo = new THREE.ConeGeometry(0.05, 0.15, 8);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0x0000ff }); // Azul
  const cone = new THREE.Mesh(coneGeo, coneMat);
  // El cono apunta hacia -Z (la dirección de vista de la cámara)
  cone.position.set(0, 0, -0.15);
  cone.rotation.x = -Math.PI / 2;

  // El cono es hijo del cubo, como pediste
  cube.add(cone);
  // El cubo es hijo del rig
  rig.add(cube);

  // 3. Añadir el rig a la escena
  scene.add(rig);

  // 4. Preparar los datos de la animación
  const times = poses.map(p => p.t);
  const posArr = poses.flatMap(p => [p.pos.x, p.pos.y, p.pos.z]);
  const rotArr = poses.flatMap(p => [p.rot.x, p.rot.y, p.rot.z, p.rot.w]);

  // 5. Crear los canales separados vinculados al RIG
  const posTrack = new THREE.VectorKeyframeTrack('CameraRig.position', times, posArr);
  const rotTrack = new THREE.QuaternionKeyframeTrack('CameraRig.quaternion', times, rotArr);

  // 6. Calcular duración real (último tiempo del keyframe)
  const duration = times.length > 0 ? times[times.length - 1] : 0;
  const clip = new THREE.AnimationClip('CameraMotion', duration, [posTrack, rotTrack]);

  // 7. Posicionar el rig en el primer frame para que se vea algo al importar
  if (poses.length > 0) {
    rig.position.set(poses[0].pos.x, poses[0].pos.y, poses[0].pos.z);
    rig.quaternion.set(poses[0].rot.x, poses[0].rot.y, poses[0].rot.z, poses[0].rot.w);
  }

  // 8. Exportar
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => resolve(new Blob([result], { type: 'model/gltf-binary' })),
      reject,
      {
        binary: true,
        animations: [clip],
        trs: true // Fuerza a exportar traslación, rotación y escala por separado
      }
    );
  });
}