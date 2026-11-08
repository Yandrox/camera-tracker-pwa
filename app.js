import { AlvaAR } from './lib/alva_ar.js';
import { exportToGLTF } from './exporter.js';

const video    = document.getElementById('video');
const overlay  = document.getElementById('overlay');
const ctx      = overlay.getContext('2d');
const statusEl = document.getElementById('status');
const btnRec   = document.getElementById('btn-record');
const btnExp   = document.getElementById('btn-export');

let alva = null;
let poses = [];
let recording = false;
let t0 = 0;

async function start() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: 640, height: 480 },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    overlay.width  = video.videoWidth;
    overlay.height = video.videoHeight;

    statusEl.textContent = 'Cargando SLAM…';
    alva = await AlvaAR.Initialize(video.videoWidth, video.videoHeight);
    statusEl.textContent = 'Listo. Pulsa Grabar.';
    requestAnimationFrame(loop);

  } catch (e) {
    console.error("ERROR CRÍTICO:", e);
    // Esto mostrará el error en pantalla en lugar de quedarse colgado
    statusEl.textContent = '⚠️ Error: ' + (e.message || 'Fallo al cargar el motor 3D');
  }
}

const tmp = document.createElement('canvas');
const tmpCtx = tmp.getContext('2d', { willReadFrequently: true });

function loop() {
  requestAnimationFrame(loop);
  if (!alva || video.readyState < 2) return;

  tmp.width = video.videoWidth;
  tmp.height = video.videoHeight;
  tmpCtx.drawImage(video, 0, 0);
  const frame = tmpCtx.getImageData(0, 0, tmp.width, tmp.height);

  const pose = alva.findCameraPose(frame);
  const pts  = alva.getFramePoints();

  ctx.clearRect(0, 0, overlay.width, overlay.height);
  ctx.fillStyle = '#22ff88';
  for (const p of pts) ctx.fillRect(p.x, p.y, 2, 2);

  if (recording && pose) {
    if (t0 === 0) t0 = performance.now();
    // AlvaAR puede devolver un Matrix4 o un objeto con position/quaternion.
    // Normalizamos aquí para no acoplarnos a su API interna:
    const pos = pose.position
      ? pose.position
      : { x: pose.elements[12], y: pose.elements[13], z: pose.elements[14] };
    const q = pose.quaternion || quatFromMatrix(pose);
    poses.push({
      t: (performance.now() - t0) / 1000,
      pos: { x: pos.x, y: pos.y, z: pos.z },
      rot: { x: q.x, y: q.y, z: q.z, w: q.w }
    });
  }
}

function quatFromMatrix(m) {
  const e = m.elements || m;
  const m11=e[0], m12=e[4], m13=e[8];
  const m21=e[1], m22=e[5], m23=e[9];
  const m31=e[2], m32=e[6], m33=e[10];
  const tr = m11 + m22 + m33;
  let x, y, z, w;
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    w = 0.25 / s; x = (m32 - m23) * s; y = (m13 - m31) * s; z = (m21 - m12) * s;
  } else if (m11 > m22 && m11 > m33) {
    const s = 2 * Math.sqrt(1 + m11 - m22 - m33);
    w = (m32 - m23) / s; x = 0.25 * s; y = (m12 + m21) / s; z = (m13 + m31) / s;
  } else if (m22 > m33) {
    const s = 2 * Math.sqrt(1 + m22 - m11 - m33);
    w = (m13 - m31) / s; x = (m12 + m21) / s; y = 0.25 * s; z = (m23 + m32) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
    w = (m21 - m12) / s; x = (m13 + m31) / s; y = (m23 + m32) / s; z = 0.25 * s;
  }
  return { x, y, z, w };
}

btnRec.addEventListener('click', () => {
  if (!recording) {
    poses = []; t0 = 0;
    recording = true;
    btnRec.textContent = '■ Detener';
    btnRec.classList.add('active');
    statusEl.textContent = 'Grabando trayectoria…';
  } else {
    recording = false;
    btnRec.textContent = '● Grabar';
    btnRec.classList.remove('active');
    statusEl.textContent = `Detenido. ${poses.length} muestras.`;
  }
});

btnExp.addEventListener('click', async () => {
  if (poses.length < 2) {
    statusEl.textContent = 'Graba algo antes de exportar.';
    return;
  }
  statusEl.textContent = 'Generando GLB…';
  const blob = await exportToGLTF(poses);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'camera-track.glb';
  a.click();
  statusEl.textContent = '¡Exportado!';
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

start();