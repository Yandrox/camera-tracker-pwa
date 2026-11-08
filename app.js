import * as THREE from 'three';
import { exportToGLTF } from './exporter.js';

const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const statusEl = document.getElementById('status');
const btnRec = document.getElementById('btn-record');
const btnExp = document.getElementById('btn-export');

let poses = [];
let recording = false;
let t0 = 0;
let lastTime = 0;
let velocity = { x: 0, y: 0, z: 0 };
let position = { x: 0, y: 0, z: 0 };
let orientation = { alpha: 0, beta: 0, gamma: 0 };
let sampleInterval = null;

// --- 1. Función de permisos corregida para Android ---
async function requestSensorPermissions() {
  // Intentamos pedir permisos solo si la API existe (iOS)
  // Si estamos en Android, esta función no existe y pasa de largo.
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm !== 'granted') {
        console.warn('Permiso de orientación denegado en el navegador, pero continuamos por si acaso.');
      }
    } catch (e) {
      console.warn('Error pidiendo permiso de orientación (ignorado)', e);
    }
  }
  if (typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const perm = await DeviceMotionEvent.requestPermission();
      if (perm !== 'granted') {
        console.warn('Permiso de movimiento denegado, pero continuamos.');
      }
    } catch (e) {
      console.warn('Error pidiendo permiso de movimiento (ignorado)', e);
    }
  }
  // Al no devolver false, garantizamos que la grabación continúe en Android
}

// --- 2. Iniciar cámara de fondo ---
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: 640, height: 480 },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
    statusEl.textContent = 'Listo. Pulsa "Grabar".';
  } catch (e) {
    statusEl.textContent = 'Error al acceder a la cámara: ' + e.message;
  }
}

// --- 3. Escuchar orientación (giroscopio) ---
window.addEventListener('deviceorientation', (event) => {
  orientation.alpha = event.alpha || 0;
  orientation.beta = event.beta || 0;
  orientation.gamma = event.gamma || 0;
}, true);

// --- 4. Escuchar movimiento (acelerómetro) ---
window.addEventListener('devicemotion', (event) => {
  const acc = event.acceleration;
  if (!acc) return;

  const now = performance.now();
  if (lastTime === 0) {
    lastTime = now;
    return;
  }
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  if (!recording) return;

  // Integración de la aceleración lineal (sin gravedad)
  // Usamos un amortiguamiento (damping) para reducir la deriva acumulada
  const damping = 0.95;
  velocity.x = (velocity.x + acc.x * dt) * damping;
  velocity.y = (velocity.y + acc.y * dt) * damping;
  velocity.z = (velocity.z + acc.z * dt) * damping;

  position.x += velocity.x * dt;
  position.y += velocity.y * dt;
  position.z += velocity.z * dt;
}, true);

// --- 5. Convertir orientación a cuaternión ---
function getQuaternion() {
  const alpha = THREE.MathUtils.degToRad(orientation.alpha);
  const beta = THREE.MathUtils.degToRad(orientation.beta);
  const gamma = THREE.MathUtils.degToRad(orientation.gamma);
  
  // El orden 'YXZ' es el estándar para la orientación de dispositivos móviles en Three.js
  const euler = new THREE.Euler(beta, alpha, -gamma, 'YXZ');
  const quat = new THREE.Quaternion().setFromEuler(euler);
  return { x: quat.x, y: quat.y, z: quat.z, w: quat.w };
}

// --- 6. Muestreo a ~30 FPS mientras se graba ---
function startSampling() {
  sampleInterval = setInterval(() => {
    if (!recording) return;
    
    const t = performance.now();
    if (t0 === 0) t0 = t;
    const relT = (t - t0) / 1000;
    
    const q = getQuaternion();
    poses.push({
      t: relT,
      pos: { ...position },
      rot: q
    });
  }, 33);
}

function stopSampling() {
  if (sampleInterval) {
    clearInterval(sampleInterval);
    sampleInterval = null;
  }
}

// --- 7. Eventos de los botones ---
btnRec.addEventListener('click', async () => {
  if (!recording) {
    await requestSensorPermissions();

    poses = [];
    t0 = 0;
    lastTime = 0;
    velocity = { x: 0, y: 0, z: 0 };
    position = { x: 0, y: 0, z: 0 };

    recording = true;
    btnRec.textContent = '■ Detener';
    btnRec.classList.add('active'); // Para la animación roja en el CSS
    statusEl.textContent = 'Grabando (mueve el teléfono)…';
    startSampling();
  } else {
    recording = false;
    btnRec.textContent = '● Grabar';
    btnRec.classList.remove('active');
    statusEl.textContent = `Detenido. ${poses.length} muestras capturadas.`;
    stopSampling();
  }
});

btnExp.addEventListener('click', async () => {
  if (poses.length < 2) {
    statusEl.textContent = 'Graba algo primero.';
    return;
  }
  statusEl.textContent = 'Generando GLB…';
  try {
    const blob = await exportToGLTF(poses);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'camera-track-imu.glb';
    a.click();
    statusEl.textContent = '¡Exportado con éxito!';
  } catch (e) {
    statusEl.textContent = 'Error al exportar: ' + e.message;
  }
});

// --- 8. Arranque de la aplicación ---
startCamera();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}