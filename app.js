import { exportToGLTF } from './exporter.js';

const video = document.getElementById('video');
const statusEl = document.getElementById('status');
const diagEl = document.getElementById('diag');
const btnRec = document.getElementById('btn-record');
const btnExp = document.getElementById('btn-export');
const btnInfo = document.getElementById('btn-info');

let poses = [];
let recording = false;
let t0 = 0;
let sampleInterval = null;

// --- Estado de orientación (sin cambios) ---
let orientation = { alpha: 0, beta: 0, gamma: 0 };
let alphaRef = 0;
let iosPermission = null;
let oriCount = 0;
let motCount = 0;
let lastAcc = { x: 0, y: 0, z: 0, src: 'ninguno' };
let oriAtStart = 0;
let motAtStart = 0;
let firstQ = null;
let rotChanged = false;
let posChanged = false;

// --- NUEVO: Estado para PDR + calibración + ZUPT ---
let gravity = null;                     // para el filtro de gravedad cuando acceleration no está disponible
let bias = { x: 0, y: 0, z: 0 };        // sesgo estimado del acelerómetro (calibración)
let calibrating = false;
let calibSamples = [];
let calibStartTime = 0;
const CALIB_MS = 2000;                  // 2 s de calibración (teléfono quieto)

let stepPeak = false;                   // estado del detector de picos
let lastStepTime = 0;
let lastStepAcc = 0;                    // aceleración en el último pico válido
const STEP_MIN_INTERVAL = 300;          // ms entre pasos (evita falsos positivos)
const STEP_ACC_THRESHOLD = 1.2;         // m/s² de aceleración lineal para considerar un pico
let stepCount = 0;

// Factor de calibración de Weinberg (ajústalo si la escala no te cuadra)
const WEINBERG_K = 0.45;                

// --- MATH-START (sin cambios) ---
function qmul(a, b) { /* ... igual que antes ... */ }
function rotateVec(q, v) { /* ... igual que antes ... */ }
function eulerToQuat(alphaDeg, betaDeg, gammaDeg) { /* ... igual que antes ... */ }
// --- MATH-END ---

function getQuaternion() {
  return eulerToQuat(orientation.alpha - alphaRef, orientation.beta, orientation.gamma);
}

// ... requestSensorPermissions, startCamera, deviceorientation ... (sin cambios)
// ... sensorAdvice, setInterval de diagnóstico ... (sin cambios)

// --- NUEVO: procesar cada evento de aceleración ---
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

  if (!recording) return;

  // 1) Calibración inicial (primeros 2 s de grabación)
  if (calibrating) {
    calibSamples.push({ x: a.x, y: a.y, z: a.z });
    if (performance.now() - calibStartTime >= CALIB_MS) {
      // Calcular sesgo medio
      const n = calibSamples.length;
      bias.x = calibSamples.reduce((s, v) => s + v.x, 0) / n;
      bias.y = calibSamples.reduce((s, v) => s + v.y, 0) / n;
      bias.z = calibSamples.reduce((s, v) => s + v.z, 0) / n;
      calibrating = false;
      statusEl.textContent = 'Calibrado. Camina con pasos normales.';
    }
    return; // durante calibración no se procesan pasos
  }

  // 2) Restar el sesgo calibrado
  const ax = a.x - bias.x;
  const ay = a.y - bias.y;
  const az = a.z - bias.z;

  // 3) Magnitud de la aceleración lineal (para detección de picos)
  const mag = Math.hypot(ax, ay, az);

  // 4) Detección de paso por pico con umbral y tiempo mínimo
  const now = performance.now();
  if (!stepPeak) {
    if (mag > STEP_ACC_THRESHOLD) {
      stepPeak = true;
      lastStepAcc = mag;
    }
  } else {
    // rastrear el máximo del pico
    if (mag > lastStepAcc) lastStepAcc = mag;
    // si la magnitud cae por debajo del umbral, el pico termina
    if (mag < STEP_ACC_THRESHOLD * 0.6) {
      stepPeak = false;
      const dt = now - lastStepTime;
      if (dt > STEP_MIN_INTERVAL && lastStepTime > 0) {
        // --- PASO VÁLIDO ---
        stepCount++;
        lastStepTime = now;

        // 4a) Longitud de paso con Weinberg: L = K * (acc_max - acc_min)^(1/4)
        //     Usamos la amplitud del pico como aproximación de (max - min)
        //     (min ≈ 0 tras restar el sesgo, así que usamos lastStepAcc)
        const L = WEINBERG_K * Math.pow(lastStepAcc, 0.25);

        // 4b) Dirección de avance: vector "forward" del dispositivo en el mundo
        const q = getQuaternion();
        const forward = rotateVec(q, { x: 0, y: 0, z: -1 }); // -Z local → forward
        const horiz = Math.hypot(forward.x, forward.z) || 1;
        const dirX = forward.x / horiz;
        const dirZ = forward.z / horiz;

        // 4c) Actualizar posición (solo plano horizontal)
        poses.push({
          t: (now - t0) / 1000,
          pos: { x: poses.length ? poses[poses.length-1].pos.x + dirX * L : dirX * L,
                 y: 0, // ZUPT vertical: la altura se mantiene a 0
                 z: poses.length ? poses[poses.length-1].pos.z + dirZ * L : dirZ * L },
          rot: q
        });
        posChanged = true; // al menos un paso detectado
      }
    }
  }
}, true);

// --- El resto del código (startSampling, stopSampling, diagnóstico, botones, exportación) ---
// ... (sin cambios, salvo que ya no se usa `velocity` ni `lastTime`) ...

function startSampling() {
  sampleInterval = setInterval(() => {
    if (!recording) return;
    // Solo para el diagnóstico: no añadimos poses aquí (se añaden en cada paso)
    // Pero mantenemos el temporizador para el contador de muestras? 
    // Mejor: no usamos startSampling para poses, sino solo para el estado de "grabando".
    // Podemos dejar el intervalo pero sin hacer push.
  }, 33);
}

function stopSampling() {
  if (sampleInterval) { clearInterval(sampleInterval); sampleInterval = null; }
}

// ... (resto igual: f, UA, permisos, sensorAdvice, setInterval de diagnóstico, botón Grabar, doExport) ...