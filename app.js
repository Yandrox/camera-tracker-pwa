import { exportToGLTF } from './exporter.js';

const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const statusEl = document.getElementById('status');
const btnRec = document.getElementById('btn-record');
const btnExp = document.getElementById('btn-export');

btnRec.textContent = 'Grabar';
btnExp.textContent = 'Exportar GLTF';

// Panel de diagnostico: muestra en vivo si los sensores entregan datos
const diagEl = document.createElement('p');
diagEl.style.cssText = 'font:12px monospace;color:#94a3b8;white-space:pre-wrap;text-align:center;max-width:500px';
statusEl.after(diagEl);

let poses = [];
let recording = false;
let t0 = 0;
let lastTime = 0;
let sampleInterval = null;
let velocity = { x: 0, y: 0, z: 0 };
let position = { x: 0, y: 0, z: 0 };
let orientation = { alpha: 0, beta: 0, gamma: 0 };
let alphaRef = 0;
let iosPermission = null;
let gravity = null;
let oriCount = 0;
let motCount = 0;
let lastAcc = { x: 0, y: 0, z: 0, src: 'ninguno' };
let oriAtStart = 0;
let motAtStart = 0;
let firstQ = null;
let rotChanged = false;
let posChanged = false;

// MATH-START
function qmul(a, b) {
  return {
    x: a.x * b.w + a.w * b.x + a.y * b.z - a.z * b.y,
    y: a.y * b.w + a.w * b.y + a.z * b.x - a.x * b.z,
    z: a.z * b.w + a.w * b.z + a.x * b.y - a.y * b.x,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
  };
}

function rotateVec(q, v) {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx)
  };
}

// Euler del navegador (alpha, beta, gamma) a cuaternion de la camara trasera.
// Orden YXZ con (beta, alpha, -gamma), y giro de -90 grados en X para que
// el telefono vertical mirando al horizonte equivalga a la identidad (la camara mira hacia -Z).
function eulerToQuat(alphaDeg, betaDeg, gammaDeg) {
  const d = Math.PI / 180;
  const a = alphaDeg * d;
  const b = betaDeg * d;
  const g = -gammaDeg * d;
  const c1 = Math.cos(b / 2), s1 = Math.sin(b / 2);
  const c2 = Math.cos(a / 2), s2 = Math.sin(a / 2);
  const c3 = Math.cos(g / 2), s3 = Math.sin(g / 2);
  const qe = {
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 - s1 * s2 * c3,
    w: c1 * c2 * c3 + s1 * s2 * s3
  };
  const s = Math.SQRT1_2;
  return qmul(qe, { x: -s, y: 0, z: 0, w: s });
}
// MATH-END

function getQuaternion() {
  return eulerToQuat(orientation.alpha - alphaRef, orientation.beta, orientation.gamma);
}

// Solicitud de permisos. iOS/Safari exige llamarla dentro de un toque del usuario;
// Android/Chrome no tiene aviso (usa el ajuste del sitio); WebView depende de la app contenedora.
// Se lanzan ambas peticiones en el mismo instante para no perder el gesto del usuario.
async function requestSensorPermissions() {
  const reqs = [];
  for (const Ev of [window.DeviceOrientationEvent, window.DeviceMotionEvent]) {
    if (Ev && typeof Ev.requestPermission === 'function') {
      try { reqs.push(Ev.requestPermission()); } catch (e) { reqs.push(Promise.resolve('error')); }
    }
  }
  if (!reqs.length) return 'no-requerido';
  const res = await Promise.allSettled(reqs);
  const states = res.map((r) => (r.status === 'fulfilled' ? r.value : 'error'));
  iosPermission = states.includes('granted') ? 'granted' : (states[0] || 'error');
  return iosPermission;
}

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
    statusEl.textContent = 'Error al acceder a la camara: ' + e.message;
  }
}

// Giroscopio / orientacion
window.addEventListener('deviceorientation', (e) => {
  if (e.alpha === null && e.beta === null && e.gamma === null) return;
  oriCount++;
  orientation.alpha = e.alpha || 0;
  orientation.beta = e.beta || 0;
  orientation.gamma = e.gamma || 0;
}, true);

// Acelerometro
window.addEventListener('devicemotion', (e) => {
  let a = e.acceleration;
  let src = 'lineal';
  if (!a || a.x === null || a.y === null || a.z === null) {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x === null) return;
    if (!gravity) gravity = { x: g.x, y: g.y, z: g.z };
    gravity.x = 0.9 * gravity.x + 0.1 * g.x;
    gravity.y = 0.9 * gravity.y + 0.1 * g.y;
    gravity.z = 0.9 * gravity.z + 0.1 * g.z;
    a = { x: g.x - gravity.x, y: g.y - gravity.y, z: g.z - gravity.z };
    src = 'con gravedad filtrada';
  }
  motCount++;
  lastAcc = { x: a.x, y: a.y, z: a.z, src: src };

  const now = performance.now();
  if (lastTime === 0) { lastTime = now; return; }
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!recording) return;

  const dead = (v) => (Math.abs(v) < 0.05 ? 0 : v);
  const w = rotateVec(getQuaternion(), { x: dead(a.x), y: dead(a.y), z: dead(a.z) });
  const k = Math.exp(-1.5 * dt);
  velocity.x = (velocity.x + w.x * dt) * k;
  velocity.y = (velocity.y + w.y * dt) * k;
  velocity.z = (velocity.z + w.z * dt) * k;
  position.x += velocity.x * dt;
  position.y += velocity.y * dt;
  position.z += velocity.z * dt;
  if (Math.hypot(position.x, position.y, position.z) > 0.001) posChanged = true;
}, true);

function startSampling() {
  sampleInterval = setInterval(() => {
    if (!recording) return;
    const t = performance.now();
    if (t0 === 0) t0 = t;
    const q = getQuaternion();
    if (!firstQ) firstQ = q;
    const dot = q.x * firstQ.x + q.y * firstQ.y + q.z * firstQ.z + q.w * firstQ.w;
    if (Math.abs(dot) < 0.99999) rotChanged = true;
    poses.push({ t: (t - t0) / 1000, pos: { ...position }, rot: q });
  }, 33);
}

function stopSampling() {
  if (sampleInterval) { clearInterval(sampleInterval); sampleInterval = null; }
}

function f(v) { return (Math.round(v * 100) / 100).toFixed(2); }

// Diagnostico del entorno: explica POR QUE no llegan sensores
const UA = navigator.userAgent;
const isIOS = /iPad|iPhone|iPod/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isWebView = /; wv\)/.test(UA) || /Version\/[\d.]+ Chrome/.test(UA);
const isBrave = !!navigator.brave;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
const permState = {};
let permText = 'permisos: consultando...';
(async () => {
  const out = [];
  for (const n of ['accelerometer', 'gyroscope', 'magnetometer']) {
    try {
      const r = await navigator.permissions.query({ name: n });
      permState[n] = r.state;
      out.push(n + '=' + r.state);
    } catch (e) {
      out.push(n + '=n/d');
    }
  }
  permText = 'permisos: ' + out.join(' ');
})();

// Devuelve la accion concreta segun el entorno detectado
function sensorAdvice() {
  if (!window.isSecureContext) return 'La pagina no esta en HTTPS y el navegador bloquea los sensores. Usa la URL https de GitHub Pages.';
  if (isIOS && iosPermission === null) return 'iOS pide el permiso solo despues de un toque: pulsa Grabar y acepta.';
  if (isIOS && iosPermission !== 'granted' && iosPermission !== 'no-requerido') return 'Safari nego el acceso. Si no vuelve a preguntar: Ajustes > Safari > Borrar historial y datos, y abre la pagina de nuevo.';
  if (isWebView) return 'Esta app (WebView/APK) no entrega sensores. Abre la URL en Chrome.';
  if (permState.accelerometer === 'denied' || permState.gyroscope === 'denied') return 'Permiso bloqueado. Chrome: candado de la barra > Permisos > Sensores de movimiento = Permitir.';
  if (isBrave) return 'Brave bloquea los sensores: desactiva Shields para este sitio o usa Chrome.';
  return 'El navegador no envia eventos. Revisa que los sensores del telefono esten activos (ajustes rapidos) y prueba en Chrome.';
}
const t0Page = performance.now();

setInterval(() => {
  diagEl.textContent =
    'Giroscopio: ' + oriCount + ' eventos\n' +
    'alpha ' + f(orientation.alpha) + '  beta ' + f(orientation.beta) + '  gamma ' + f(orientation.gamma) + '\n' +
    'Acelerometro: ' + motCount + ' eventos (' + lastAcc.src + ')\n' +
    'acc ' + f(lastAcc.x) + '  ' + f(lastAcc.y) + '  ' + f(lastAcc.z) + '\n' +
    'Muestras grabadas: ' + poses.length + '\n' +
    'HTTPS/seguro: ' + (window.isSecureContext ? 'si' : 'NO') +
    '  WebView: ' + (isWebView ? 'si' : 'no') +
    '  Instalada: ' + (isStandalone ? 'si' : 'no') + '\n' +
    permText +
    (oriCount === 0 && motCount === 0 && performance.now() - t0Page > 2500
      ? '\n>> ' + sensorAdvice()
      : '');
}, 250);

btnRec.addEventListener('click', async () => {
  if (!recording) {
    await requestSensorPermissions();
    poses = [];
    t0 = 0;
    lastTime = 0;
    velocity = { x: 0, y: 0, z: 0 };
    position = { x: 0, y: 0, z: 0 };
    alphaRef = orientation.alpha;
    firstQ = null;
    rotChanged = false;
    posChanged = false;
    oriAtStart = oriCount;
    motAtStart = motCount;
    recording = true;
    btnRec.textContent = 'Detener';
    btnRec.classList.add('active');
    statusEl.textContent = 'Grabando. Mueve el telefono.';
    startSampling();
  } else {
    recording = false;
    stopSampling();
    btnRec.textContent = 'Grabar';
    btnRec.classList.remove('active');
    const nOri = oriCount - oriAtStart;
    const nMot = motCount - motAtStart;
    let msg = 'Detenido. ' + poses.length + ' muestras. Giroscopio: ' + nOri + ' eventos. Acelerometro: ' + nMot + ' eventos.';
    if (nOri === 0) msg += ' SIN datos de giroscopio. ' + sensorAdvice();
    else if (!rotChanged) msg += ' La rotacion no cambio: no moviste el telefono.';
    if (nMot === 0) msg += ' SIN datos de acelerometro.';
    else if (!posChanged) msg += ' La posicion no cambio.';
    statusEl.textContent = msg;
  }
});

btnExp.addEventListener('click', async () => {
  if (poses.length < 2) { statusEl.textContent = 'Graba algo primero.'; return; }
  statusEl.textContent = 'Generando GLTF...';
  try {
    const blob = await exportToGLTF(poses);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'camera-track.gltf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    statusEl.textContent = 'Exportado: ' + poses.length + ' muestras.' +
      (rotChanged ? '' : ' Aviso: la rotacion es constante.') +
      (posChanged ? '' : ' Aviso: la posicion es constante.');
  } catch (e) {
    statusEl.textContent = 'Error al exportar: ' + e.message;
  }
});

startCamera();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
