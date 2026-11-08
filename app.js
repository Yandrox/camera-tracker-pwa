import * as THREE from 'three';
import { exportToGLTF } from './exporter.js';

const container = document.getElementById('xr-container');
const statusEl = document.getElementById('status');
const btnStart = document.getElementById('btn-start');
const btnRec = document.getElementById('btn-record');
const btnExp = document.getElementById('btn-export');

let renderer, scene, camera, xrSession, xrRefSpace;
let poses = [];
let recording = false;
let t0 = 0;

// Inicializar Three.js (aunque sea invisible, lo necesitamos para XR)
renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
container.appendChild(renderer.domElement);

scene = new THREE.Scene();
camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);

// Luces básicas para que no se vea negro (opcional)
scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3));
scene.add(new THREE.DirectionalLight(0xffffff, 3));

async function initXR() {
  if (!navigator.xr) {
    statusEl.textContent = '⚠️ Tu navegador no soporta WebXR. Usa Chrome en Android.';
    return;
  }
  try {
    const supported = await navigator.xr.isSessionSupported('immersive-ar');
    if (!supported) {
      statusEl.textContent = '⚠️ Este dispositivo no soporta AR (WebXR).';
      return;
    }
    statusEl.textContent = 'Solicitando sesión AR…';
    xrSession = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: document.body }
    });

    await renderer.xr.setSession(xrSession);
    xrRefSpace = await xrSession.requestReferenceSpace('local');

    xrSession.addEventListener('end', onSessionEnd);
    renderer.setAnimationLoop(onXRFrame);

    btnStart.disabled = true;
    btnRec.disabled = false;
    statusEl.textContent = 'AR iniciada. Mueve el teléfono para trackear.';
  } catch (e) {
    statusEl.textContent = 'Error al iniciar AR: ' + e.message;
  }
}

function onXRFrame(time, frame) {
  const pose = frame.getViewerPose(xrRefSpace);
  if (pose && recording) {
    if (t0 === 0) t0 = time;
    const p = pose.transform.position;
    const o = pose.transform.orientation;
    poses.push({
      t: (time - t0) / 1000,
      pos: { x: p.x, y: p.y, z: p.z },
      rot: { x: o.x, y: o.y, z: o.z, w: o.w }
    });
  }
  renderer.render(scene, camera);
}

function onSessionEnd() {
  xrSession = null;
  renderer.setAnimationLoop(null);
  btnStart.disabled = false;
  btnRec.disabled = true;
  statusEl.textContent = 'Sesión AR finalizada.';
}

btnStart.addEventListener('click', initXR);

btnRec.addEventListener('click', () => {
  if (!recording) {
    poses = [];
    t0 = 0;
    recording = true;
    btnRec.textContent = '■ Detener';
    statusEl.textContent = 'Grabando trayectoria…';
  } else {
    recording = false;
    btnRec.textContent = '● Grabar';
    btnExp.disabled = false;
    statusEl.textContent = `Grabación detenida. ${poses.length} muestras.`;
  }
});

btnExp.addEventListener('click', async () => {
  if (poses.length < 2) {
    statusEl.textContent = 'Graba un movimiento primero.';
    return;
  }
  statusEl.textContent = 'Generando GLB…';
  try {
    const blob = await exportToGLTF(poses);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'camera-track.glb';
    a.click();
    statusEl.textContent = '¡Exportado!';
  } catch (e) {
    statusEl.textContent = 'Error al exportar: ' + e.message;
  }
});