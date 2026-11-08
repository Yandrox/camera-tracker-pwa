import * as THREE from 'three';
import { GLTFExporter } from './lib/jsm/exporters/GLTFExporter.js';

export async function exportToGLTF(poses) {
  const scene = new THREE.Scene();

  // 1. Crear la geometría del cubo
  const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });

  // 2. Crear un esqueleto con un solo hueso
  const bone = new THREE.Bone();
  bone.name = 'CameraRootBone';
  // Lo posicionamos en el origen; la animación moverá este hueso
  bone.position.set(0, 0, 0);

  // 3. Crear el SkinnedMesh vinculado al hueso
  // Esto le dice al motor que la malla depende del esqueleto
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = 'CameraCubeMesh';
  mesh.add(bone);
  mesh.bind(new THREE.Skeleton([bone]));

  // 4. Añadir un indicador de dirección (un pequeño cono) también al esqueleto
  //    para que herede el movimiento y la rotación del hueso
  const coneGeo = new THREE.ConeGeometry(0.05, 0.15, 8);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0x0000ff });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.set(0, 0, -0.15);
  cone.rotation.x = -Math.PI / 2;
  bone.add(cone); // El cono es hijo del hueso

  scene.add(mesh);

  // 5. Preparar las pistas de animación PARA EL HUESO, no para la malla
  const times = poses.map(p => p.t);
  const posArr = poses.flatMap(p => [p.pos.x, p.pos.y, p.pos.z]);
  const rotArr = poses.flatMap(p => [p.rot.x, p.rot.y, p.rot.z, p.rot.w]);

  // El nombre de la pista debe ser el del hueso
  const posTrack = new THREE.VectorKeyframeTrack('CameraRootBone.position', times, posArr);
  const rotTrack = new THREE.QuaternionKeyframeTrack('CameraRootBone.quaternion', times, rotArr);

  const duration = times.length > 0 ? times[times.length - 1] : 0;
  const clip = new THREE.AnimationClip('CameraMotion', duration, [posTrack, rotTrack]);

  // 6. Exportar
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => resolve(new Blob([result], { type: 'model/gltf-binary' })),
      reject,
      {
        binary: true,
        animations: [clip],
        // No forzamos TRS, dejamos que el exportador maneje el skinning de forma nativa
      }
    );
  });
}