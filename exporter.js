import * as THREE from 'three';
import { GLTFExporter } from './lib/GLTFExporter.js';

export async function exportToGLTF(poses) {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(60, 1, 0.01, 1000);
  cam.name = 'TrackedCamera';
  scene.add(cam);

  const times = poses.map(p => p.t);
  const posArr = poses.flatMap(p => [p.pos.x, p.pos.y, p.pos.z]);
  const rotArr = poses.flatMap(p => [p.rot.x, p.rot.y, p.rot.z, p.rot.w]);

  // Three.js quiere quaternion en orden (x, y, z, w) — ya es el nuestro.
  const posTrack = new THREE.VectorKeyframeTrack('TrackedCamera.position', times, posArr);
  const rotTrack = new THREE.QuaternionKeyframeTrack('TrackedCamera.quaternion', times, rotArr);

  const clip = new THREE.AnimationClip('CameraTrack', times[times.length - 1], [posTrack, rotTrack]);
  const mixer = new THREE.AnimationMixer(cam);
  mixer.clipAction(clip).play();
  mixer.update(0); // aplicar primer frame

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