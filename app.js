import { exportToGLTF } from './exporter.js';

const video = document.getElementById('video');
const statusEl = document.getElementById('status');
const diagEl = document.getElementById('diag');
const btnRec = document.getElementById('btn-record');
const btnExp = document.getElementById('btn-export');
const btnInfo = document.getElementById('btn-info');
const btnHeight = document.getElementById('btn-height'); // opcional: si no existe en el HTML, todo sigue funcionando

let poses = [];
let phase = 'idle'; // 'idle' | 'calibrating' | 'recording'
let t0 = 0;
let lastTime = 0;
let sampleInterval = null;
let position = { x: 0, y: 0, z: 0 };
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

// ---------------------------------------------------------------------------
// AJUSTES DE TRASLACION (todo en un sitio para poder afinarlo)
// ---------------------------------------------------------------------------
const G = 9.80665;
const START_HEIGHT = 0;   // m. Altura de la camara al empezar (0 = el origen es el telefono; pon 1.4 para altura de mano)
const CAL_WIN = 0.8;      // s de quietud para calibrar al pulsar Grabar
const CAL_MAX = 3.0;      // s maximos esperando quietud; si no llega, se graba sin calibrar el sesgo
const CAL_ACC = 0.30;     // m/s2: variacion maxima permitida durante la calibracion
const CAL_GYRO = 6;       // deg/s: giro medio permitido durante la calibracion
const STILL_ACC = 0.15;   // m/s2: variacion (desv. tipica) por debajo de la cual se considera "quieto"
const STILL_GYRO = 8;     // deg/s
const STEP_K = 0.46;      // factor de longitud de paso (formula de Weinberg). Si el recorrido sale corto/largo, escala este valor (ver Info > recorrido)
const STEP_MIN_ACC = 0.7; // m/s2: pico vertical minimo para contar un paso
const EPI_LONG = 8;       // s: si un movimiento sin caminar dura mas que esto sin pararse, se activa una fuga de seguridad
const LEAK_LONG = 4;      // s: constante de esa fuga de seguridad
// Altura "fija": la altura inicial se conserva (solo deja pasar el balanceo corto de la mano).
// Altura "libre": deja pasar movimientos verticales mas lentos (grua, agacharse) con mas deriva posible.
const VERT = {
  fija: { tauV: 0.5, tauP: 1.2 },   // anclado: conserva la altura, deja pasar solo el balanceo corto
  libre: { tauV: 1e9, tauP: 1e9 }   // sin caminar: integra sin fugas (la correccion de fin de movimiento y la fuga de seguridad hacen el resto)
};
let heightMode = 'fija';

// MATH-START
function qmul(a, b) {
  return {
    x: a.x * b.w + a.w * b.x + a.y * b.z - a.z * b.y,
    y: a.y * b.w + a.w * b.y + a.z * b.x - a.x * b.z,
    z: a.z * b.w + a.w * b.z + a.x * b.y - a.y * b.x,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
  };
}

function qconj(q) {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
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
// Mundo: X este, Y ARRIBA, Z sur. El marco del telefono (x derecha, y arriba de la pantalla,
// z hacia el usuario) coincide con el de la camara, asi que este mismo cuaternion sirve para
// llevar la aceleracion del telefono al mundo.
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

// ---------------------------------------------------------------------------
// ESTIMADOR DE TRASLACION
//
// Por que no basta con integrar dos veces la aceleracion: cualquier error pequeno
// (sesgo del sensor, gravedad mal restada al inclinar el telefono, ruido) crece con
// el cuadrado del tiempo, y la altura es lo que mas se nota. Ademas, caminar a
// velocidad constante casi no produce aceleracion media, asi que la integral "no ve"
// el avance. Por eso se combinan cuatro cosas:
//
//  1) CALIBRACION al pulsar Grabar: ~1 s quieto para medir el sesgo del acelerometro
//     (y el signo de la gravedad si el navegador solo da accelerationIncludingGravity).
//     Ahi se "atrapa" la altura inicial: y = START_HEIGHT.
//  2) CERO-VELOCIDAD (ZUPT): cuando el telefono esta quieto la velocidad se pone a 0
//     y el sesgo se reajusta, asi la deriva no se acumula.
//  3) ODOMETRIA POR PASOS al caminar: se detectan los pasos con el pico vertical, la
//     longitud del paso sale de la amplitud (Weinberg) y la direccion de la marcha de
//     la direccion principal de la aceleracion horizontal (con la camara como respaldo).
//     El avance horizontal ya no depende de integrar ruido.
//  4) ALTURA ANCLADA: la parte vertical se integra con fugas que la devuelven al valor
//     inicial. En modo "fija" conserva la altura; en "libre" admite movimientos lentos.
//
// Limite fisico: un acelerometro no puede medir una velocidad constante. Subir una
// loma a ritmo constante no genera aceleracion vertical medible (y el navegador no
// tiene barometro), asi que no se puede distinguir de la deriva con fiabilidad.
// ---------------------------------------------------------------------------
let biasDev = { x: 0, y: 0, z: 0 }; // sesgo en el marco del telefono
let gSign = 1;                       // +1 / -1: signo de accelerationIncludingGravity del navegador
let calOk = false;
let cal = null;
let tr = newTracker();

function newTracker() {
  return {
    v: { x: 0, y: 0, z: 0 },
    p: { x: 0, y: 0, z: 0 },
    m: { x: 0, y: 0, z: 0 }, vr: 0, init: false, gyroE: 0, stillT: 0,
    mh: { x: 0, z: 0 }, mv: 0, vrH: 0, vrV: 0, stillTH: 0, stillTV: 0,
    hl: { x: 0, z: 0 },
    sf: 0, sPrev: 0, valley: 0,
    cand: false, candVal: 0, candT: 0,
    lastStepT: -10, stepTimes: [],
    emaPeak: 2, stepLen: 0.6, stepInterval: 0.55,
    walking: false, walkEndT: -10, steps: 0,
    epiH: null, epiV: null, lastActiveH: -10, lastActiveV: -10, yRef: 0,
    hpE: 0,
    cov: { xx: 0, xz: 0, zz: 0 },
    camDir: { x: 0, z: -1 },
    heading: { x: 0, z: -1 },
    dist: 0
  };
}

function aLinear(raw, gUp) {
  // aceleracion lineal en el marco del telefono, sin sesgo
  if (gUp) {
    return {
      x: gSign * raw.x - gUp.x - biasDev.x,
      y: gSign * raw.y - gUp.y - biasDev.y,
      z: gSign * raw.z - gUp.z - biasDev.z
    };
  }
  return { x: raw.x - biasDev.x, y: raw.y - biasDev.y, z: raw.z - biasDev.z };
}

// ---- Calibracion -----------------------------------------------------------
function startCalibration() {
  cal = { t0: performance.now() / 1000, buf: [] };
  biasDev = { x: 0, y: 0, z: 0 };
  gSign = 1;
  calOk = false;
}

function calibrationStep(t, raw, gUp, gyro) {
  cal.buf.push({ t, raw, gUp, gyro });
  while (cal.buf.length && t - cal.buf[0].t > CAL_WIN) cal.buf.shift();
  const span = t - cal.buf[0].t;
  const timeout = t - cal.t0 > CAL_MAX;
  if (span < CAL_WIN * 0.9 && !timeout) return;

  const n = cal.buf.length;
  const m = { x: 0, y: 0, z: 0 };
  let gyroSum = 0, gyroN = 0;
  for (const s of cal.buf) {
    m.x += s.raw.x; m.y += s.raw.y; m.z += s.raw.z;
    if (s.gyro !== null) { gyroSum += s.gyro; gyroN++; }
  }
  const meanGyro = gyroN ? gyroSum / gyroN : 0;
  m.x /= n; m.y /= n; m.z /= n;
  let maxDev = 0;
  for (const s of cal.buf) {
    const d = Math.hypot(s.raw.x - m.x, s.raw.y - m.y, s.raw.z - m.z);
    if (d > maxDev) maxDev = d;
  }
  const still = n >= 5 && maxDev < CAL_ACC && meanGyro < CAL_GYRO;
  if (!still && !timeout) return;

  // Signo de la gravedad (solo si el navegador no da aceleracion lineal)
  if (cal.buf[0].gUp) {
    let dot = 0;
    for (const s of cal.buf) dot += s.raw.x * s.gUp.x + s.raw.y * s.gUp.y + s.raw.z * s.gUp.z;
    gSign = dot < 0 ? -1 : 1;
  }
  if (still) {
    const b = { x: 0, y: 0, z: 0 };
    for (const s of cal.buf) {
      const a = aLinear(s.raw, s.gUp); // con sesgo = 0 todavia
      b.x += a.x; b.y += a.y; b.z += a.z;
    }
    biasDev = { x: b.x / n, y: b.y / n, z: b.z / n };
    calOk = true;
  }
  beginRecording();
}

function beginRecording() {
  phase = 'recording';
  tr = newTracker();
  position = { x: 0, y: START_HEIGHT, z: 0 };
  poses = [];
  t0 = 0;
  alphaRef = orientation.alpha; // el rumbo inicial pasa a ser 0
  firstQ = null;
  rotChanged = false;
  posChanged = false;
  statusEl.textContent = 'Grabando. Mueve el telefono.' +
    (calOk ? '' : ' (No se pudo calibrar: no estabas quieto.)');
  startSampling();
}

// ---- Pasos -----------------------------------------------------------------
function detectSteps(T, t, dt, w) {
  T.sPrev = T.sf;
  T.sf += (w.y - T.sf) * (1 - Math.exp(-dt / 0.045)); // paso bajo ~3.5 Hz sobre la aceleracion vertical
  if (T.sf < T.valley) T.valley = T.sf;
  const thr = Math.max(STEP_MIN_ACC, 0.45 * T.emaPeak);

  if (T.cand) {
    if (T.sf > T.candVal) { T.candVal = T.sf; T.candT = t; }
    else if (T.sf < T.candVal * 0.75) {
      confirmStep(T, T.candT, T.candVal);
      T.cand = false;
    }
  } else if (T.sf > thr && T.sf > T.sPrev) {
    T.cand = true; T.candVal = T.sf; T.candT = t;
  }

  const lim = Math.max(0.6, 1.25 * T.stepInterval);
  if (T.walking && t - T.lastStepT > lim) {
    T.walking = false;
    T.walkEndT = t;
  }
}

function confirmStep(T, tPeak, peak) {
  const gap = tPeak - T.lastStepT;
  if (gap < 0.28) return; // rebote del mismo paso
  const range = peak - T.valley;
  T.valley = T.sf;
  T.emaPeak = 0.7 * T.emaPeak + 0.3 * peak;
  if (gap > 1.2) T.stepTimes = [];
  T.stepTimes.push(tPeak);
  if (T.stepTimes.length > 4) T.stepTimes.shift();
  T.lastStepT = tPeak;

  const n = T.stepTimes.length;
  if (n < 3) return;
  const i1 = T.stepTimes[n - 1] - T.stepTimes[n - 2];
  const i2 = T.stepTimes[n - 2] - T.stepTimes[n - 3];
  const regular = i1 > 0.3 && i1 < 0.95 && i2 > 0.3 && i2 < 0.95 &&
    Math.abs(i1 - i2) < 0.4 * Math.max(i1, i2);
  const moves = Math.sqrt(T.hpE) > 0.2; // un balanceo solo vertical (agitar el telefono) no es caminar
  if (regular && moves) {
    T.walking = true;
    T.stepInterval = 0.5 * T.stepInterval + 0.5 * (0.5 * (i1 + i2));
    const L = Math.min(1.0, Math.max(0.3, STEP_K * Math.pow(Math.max(range, 0.1), 0.25)));
    T.stepLen = 0.6 * T.stepLen + 0.4 * L;
    T.steps++;
  } else {
    T.walking = false;
  }
}

// ---- Direccion de la marcha ------------------------------------------------
function updateHeading(T, dt, w, q) {
  // direccion hacia donde mira la camara, proyectada al suelo
  const f = rotateVec(q, { x: 0, y: 0, z: -1 });
  let cx = f.x, cz = f.z, len = Math.hypot(cx, cz);
  if (len < 0.4) { // telefono mirando casi al suelo/cielo: usar la parte alta de la pantalla
    const u = rotateVec(q, { x: 0, y: 1, z: 0 });
    cx = u.x; cz = u.z; len = Math.hypot(cx, cz);
  }
  if (len > 0.2) T.camDir = { x: cx / len, z: cz / len };

  // direccion principal del vaiven horizontal al ritmo del paso (se filtra el balanceo lateral lento)
  const khp = 1 - Math.exp(-dt / 0.13);
  const hx = w.x - T.hl.x, hz = w.z - T.hl.z; // pasa-altos ~1.2 Hz
  T.hl.x += (w.x - T.hl.x) * khp; T.hl.z += (w.z - T.hl.z) * khp;
  T.hpE += ((hx * hx + hz * hz) - T.hpE) * (1 - Math.exp(-dt / 1.0)); // energia horizontal al ritmo del paso
  if (T.walking) {
    const kc = 1 - Math.exp(-dt / 2.0);
    T.cov.xx += (hx * hx - T.cov.xx) * kc;
    T.cov.xz += (hx * hz - T.cov.xz) * kc;
    T.cov.zz += (hz * hz - T.cov.zz) * kc;
  }
  let dir = T.camDir;
  const { xx, xz, zz } = T.cov;
  const half = Math.sqrt((xx - zz) * (xx - zz) / 4 + xz * xz);
  const l1 = (xx + zz) / 2 + half;
  const l2 = (xx + zz) / 2 - half;
  const ratio = l1 / (l2 + 1e-4);
  if (T.walking && l1 > 0.05 && ratio > 1.8) {
    const th = 0.5 * Math.atan2(2 * xz, xx - zz);
    let d = { x: Math.cos(th), z: Math.sin(th) };
    const dc = d.x * T.camDir.x + d.z * T.camDir.z;
    if (dc < 0) d = { x: -d.x, z: -d.z }; // la ambiguedad de 180 grados se resuelve con la camara
    if (Math.abs(dc) > 0.17) {            // solo si no se aleja mas de ~80 grados de donde mira la camara
      const wt = Math.min(1, (ratio - 1.8) / 2.5); // confianza segun lo marcada que sea la direccion
      const bx = wt * d.x + (1 - wt) * T.camDir.x, bz = wt * d.z + (1 - wt) * T.camDir.z;
      const bl = Math.hypot(bx, bz);
      if (bl > 1e-3) dir = { x: bx / bl, z: bz / bl };
    }
  }
  const kh = 1 - Math.exp(-dt / 0.4);
  const nx = T.heading.x + (dir.x - T.heading.x) * kh;
  const nz = T.heading.z + (dir.z - T.heading.z) * kh;
  const nl = Math.hypot(nx, nz);
  if (nl > 1e-3) T.heading = { x: nx / nl, z: nz / nl };
}

// ---- Correccion al terminar un movimiento sin caminar ----------------------
// Si el telefono se movio y luego se detuvo, la velocidad final DEBE ser 0. Lo que sobre es
// el error acumulado (sesgo, gravedad mal restada); se reparte linealmente sobre ese tramo y
// se corrigen tambien las poses ya grabadas. Asi un travelling corto o una grua no derivan.
function detrendPoses(ts, te, dv) {
  const dur = te - ts;
  const base = t0 / 1000;
  for (let i = poses.length - 1; i >= 0; i--) {
    const ta = base + poses[i].t;
    if (ta < ts) break;
    const u = Math.min(ta, te) - ts;
    const k = (u * u) / (2 * dur);
    poses[i].pos.x -= dv.x * k;
    poses[i].pos.y -= dv.y * k;
    poses[i].pos.z -= dv.z * k;
  }
}

function closeEpisodeH(T) {
  const e = T.epiH;
  T.epiH = null;
  if (!e || e.walked) return;
  const ts = e.ts;
  const te = Math.max(T.lastActiveH + 0.1, ts + 0.3);
  const dur = te - ts;
  if (dur < 0.4 || dur > 12) return;
  detrendPoses(ts, te, { x: T.v.x, y: 0, z: T.v.z });
  T.p.x -= T.v.x * dur / 2;
  T.p.z -= T.v.z * dur / 2;
}

function closeEpisodeV(T) {
  const e = T.epiV;
  T.epiV = null;
  if (!e || !e.libre || heightMode !== 'libre') return;
  const ts = e.ts;
  const te = Math.max(T.lastActiveV + 0.1, ts + 0.3);
  const dur = te - ts;
  if (dur < 0.4 || dur > 12) return;
  detrendPoses(ts, te, { x: 0, y: T.v.y, z: 0 });
  T.p.y -= T.v.y * dur / 2;
}

// ---- Paso principal del estimador -----------------------------------------
// La quietud se decide POR SEPARADO para el plano horizontal y para la vertical: agitar el
// telefono arriba y abajo no debe habilitar deriva horizontal, ni al reves.
function trackerStep(t, dt, raw, gUp, gyro, q) {
  const T = tr;
  const a = aLinear(raw, gUp);
  const w = rotateVec(q, a); // aceleracion en el mundo (Y arriba)
  const mag = Math.hypot(a.x, a.y, a.z);
  const kq = 1 - Math.exp(-dt / 0.25);

  // variacion de la aceleracion (no su valor): un desvio constante (sesgo, gravedad mal restada)
  // no impide detectar que el telefono esta quieto
  if (!T.init) {
    T.m = { x: a.x, y: a.y, z: a.z };
    T.mh = { x: w.x, z: w.z }; T.mv = w.y;
    T.init = true;
  }
  T.m.x += (a.x - T.m.x) * kq; T.m.y += (a.y - T.m.y) * kq; T.m.z += (a.z - T.m.z) * kq;
  const dvAll = (a.x - T.m.x) * (a.x - T.m.x) + (a.y - T.m.y) * (a.y - T.m.y) + (a.z - T.m.z) * (a.z - T.m.z);
  T.vr += (dvAll - T.vr) * kq;
  T.mh.x += (w.x - T.mh.x) * kq; T.mh.z += (w.z - T.mh.z) * kq; T.mv += (w.y - T.mv) * kq;
  const dvH = (w.x - T.mh.x) * (w.x - T.mh.x) + (w.z - T.mh.z) * (w.z - T.mh.z);
  const dvV = (w.y - T.mv) * (w.y - T.mv);
  T.vrH += (dvH - T.vrH) * kq;
  T.vrV += (dvV - T.vrV) * kq;
  T.gyroE += ((gyro === null ? 0 : gyro) - T.gyroE) * kq;
  const gyroQuiet = T.gyroE < STILL_GYRO;
  const quiet = Math.sqrt(T.vr) < STILL_ACC && gyroQuiet;
  T.stillT = quiet ? T.stillT + dt : 0;
  T.stillTH = (Math.sqrt(T.vrH) < STILL_ACC && gyroQuiet) ? T.stillTH + dt : 0;
  T.stillTV = (Math.sqrt(T.vrV) < STILL_ACC && gyroQuiet) ? T.stillTV + dt : 0;
  const stillH = T.stillTH > 0.3;
  const stillV = T.stillTV > 0.3;
  if (T.stillT > 0.6) { // reajuste lento del sesgo mientras esta todo quieto
    const kb = 1 - Math.exp(-dt / 4);
    biasDev.x += a.x * kb; biasDev.y += a.y * kb; biasDev.z += a.z * kb; // 'a' ya es el residuo tras restar el sesgo
  }
  const devH = Math.sqrt(dvH), devV = Math.sqrt(dvV);
  if (devH > 0.35) T.lastActiveH = t;
  if (devV > 0.35) T.lastActiveV = t;

  detectSteps(T, t, dt, w);
  updateHeading(T, dt, w, q);

  // episodios de movimiento (para corregir la deriva cuando terminan)
  if (!T.epiH && !stillH && devH > 0.35 && !T.walking) T.epiH = { ts: t - 0.15, walked: false };
  if (T.epiH && T.walking) T.epiH.walked = true;
  if (!T.epiV && !stillV && devV > 0.35) T.epiV = { ts: t - 0.15, libre: heightMode === 'libre' };

  // horizontal
  if (T.walking) {
    const speed = T.stepLen / T.stepInterval;
    const kp = 1 - Math.exp(-dt / 0.25);
    T.v.x += (T.heading.x * speed - T.v.x) * kp;
    T.v.z += (T.heading.z * speed - T.v.z) * kp;
  } else if (stillH) {
    closeEpisodeH(T);
    const kz = Math.exp(-dt / 0.05);
    T.v.x *= kz; T.v.z *= kz;
  } else {
    // integracion sin fuga; solo hay fuga rapida justo despues de caminar y fuga de seguridad en movimientos muy largos
    const epiLong = T.epiH && t - T.epiH.ts > EPI_LONG;
    const tau = (t - T.walkEndT < 0.6) ? 0.15 : (epiLong ? LEAK_LONG : 1e9);
    const sh = Math.max(0, 1 - 0.04 / Math.max(Math.hypot(w.x, w.z), 0.04)); // zona muerta suave sobre el vector
    const kf = Math.exp(-dt / tau);
    T.v.x = T.v.x * kf + w.x * sh * dt;
    T.v.z = T.v.z * kf + w.z * sh * dt;
  }
  T.p.x += T.v.x * dt;
  T.p.z += T.v.z * dt;
  T.dist += Math.hypot(T.v.x, T.v.z) * dt;

  // vertical
  // fija -> siempre anclado a la altura inicial. libre -> al no caminar integra como el horizontal;
  // al caminar se ancla a la ultima altura en reposo (no se puede seguir una pendiente sostenida).
  if (stillV) closeEpisodeV(T);
  const sv = stillV ? 0 : Math.max(0, 1 - 0.04 / Math.max(Math.abs(w.y), 0.04));
  if (heightMode === 'fija') T.yRef = 0;
  else if (stillV && !T.walking) T.yRef = T.p.y;
  if (heightMode === 'fija' || T.walking) {
    const vp = VERT.fija;
    T.v.y = T.v.y * Math.exp(-dt / vp.tauV) + w.y * sv * dt;
    T.p.y = T.yRef + (T.p.y - T.yRef) * Math.exp(-dt / vp.tauP) + T.v.y * dt;
  } else {
    const epiLongY = T.epiV && t - T.epiV.ts > EPI_LONG;
    T.v.y = T.v.y * Math.exp(-dt / (epiLongY ? LEAK_LONG : VERT.libre.tauV)) + w.y * sv * dt;
    T.p.y = T.p.y * Math.exp(-dt / VERT.libre.tauP) + T.v.y * dt;
  }
  if (stillV) T.v.y *= Math.exp(-dt / 0.05);

  position = { x: T.p.x, y: START_HEIGHT + T.p.y, z: T.p.z };
  if (Math.hypot(T.p.x, T.p.y, T.p.z) > 0.001) posChanged = true;
}

// Velocidad angular en deg/s (null si el navegador no entrega rotationRate: entonces la quietud
// se decide solo con la aceleracion)
function gyroRate(e) {
  const rr = e.rotationRate;
  if (rr && rr.alpha !== null && rr.beta !== null && rr.gamma !== null && rr.alpha !== undefined) {
    return Math.hypot(rr.alpha, rr.beta, rr.gamma);
  }
  return null;
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
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
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
  let raw;
  let gUp = null;
  let src;
  const lin = e.acceleration;
  const q = getQuaternion();
  if (lin && lin.x !== null && lin.y !== null && lin.z !== null) {
    raw = { x: lin.x, y: lin.y, z: lin.z };
    src = 'lineal';
  } else {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x === null || g.y === null || g.z === null) return;
    raw = { x: g.x, y: g.y, z: g.z };
    // La gravedad se calcula con la orientacion (sin retraso), no con un filtro que se come el movimiento
    gUp = rotateVec(qconj(q), { x: 0, y: G, z: 0 });
    src = 'con gravedad (por orientacion)';
  }
  motCount++;
  lastAcc = { x: raw.x, y: raw.y, z: raw.z, src: src };

  const now = performance.now();
  const nowS = now / 1000;
  const gyro = gyroRate(e);
  if (lastTime === 0) { lastTime = now; return; }
  const dt = Math.min(Math.max((now - lastTime) / 1000, 0.001), 0.1);
  lastTime = now;

  if (phase === 'calibrating') { calibrationStep(nowS, raw, gUp, gyro); return; }
  if (phase !== 'recording') return;
  trackerStep(nowS, dt, raw, gUp, gyro, q);
}, true);

function startSampling() {
  sampleInterval = setInterval(() => {
    if (phase !== 'recording') return;
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

let infoAutoShown = false;
btnInfo.addEventListener('click', () => diagEl.classList.toggle('hidden'));

if (btnHeight) {
  btnHeight.textContent = 'Altura: ' + heightMode;
  btnHeight.addEventListener('click', () => {
    heightMode = heightMode === 'fija' ? 'libre' : 'fija';
    btnHeight.textContent = 'Altura: ' + heightMode;
  });
}

setInterval(() => {
  if (phase === 'calibrating') {
    statusEl.textContent = 'Calibrando: mantén el telefono quieto un momento...';
  } else if (phase === 'recording') {
    const secs = poses.length ? poses[poses.length - 1].t : 0;
    statusEl.textContent = 'Grabando: ' + secs.toFixed(1) + ' s' + (tr.walking ? '  (caminando)' : '');
  }
  diagEl.textContent =
    'Giroscopio: ' + oriCount + ' eventos\n' +
    'alpha ' + f(orientation.alpha) + '  beta ' + f(orientation.beta) + '  gamma ' + f(orientation.gamma) + '\n' +
    'Acelerometro: ' + motCount + ' eventos (' + lastAcc.src + ')\n' +
    'acc ' + f(lastAcc.x) + '  ' + f(lastAcc.y) + '  ' + f(lastAcc.z) + '\n' +
    'Muestras grabadas: ' + poses.length + '\n' +
    'Calibracion: ' + (calOk ? 'ok' : 'pendiente/sin calibrar') +
    '  sesgo ' + f(biasDev.x) + ' ' + f(biasDev.y) + ' ' + f(biasDev.z) + '\n' +
    'Altura: ' + heightMode + '  y=' + f(position.y) + ' m   variacion acc ' + f(Math.sqrt(tr.vr)) + '\n' +
    'Pasos: ' + tr.steps + '  marcha: ' + (tr.walking ? 'si' : 'no') +
    '  paso ' + f(tr.stepLen) + ' m  recorrido ' + f(tr.dist) + ' m\n' +
    'HTTPS/seguro: ' + (window.isSecureContext ? 'si' : 'NO') +
    '  WebView: ' + (isWebView ? 'si' : 'no') +
    '  Instalada: ' + (isStandalone ? 'si' : 'no') + '\n' +
    permText +
    (oriCount === 0 && motCount === 0 && performance.now() - t0Page > 2500
      ? '\n>> ' + sensorAdvice()
      : '');
  if (!infoAutoShown && oriCount === 0 && motCount === 0 && performance.now() - t0Page > 2500) {
    infoAutoShown = true;
    diagEl.classList.remove('hidden');
  }
}, 250);

btnRec.addEventListener('click', async () => {
  if (phase === 'idle') {
    await requestSensorPermissions();
    poses = [];
    t0 = 0;
    lastTime = 0;
    oriAtStart = oriCount;
    motAtStart = motCount;
    tr = newTracker();
    position = { x: 0, y: START_HEIGHT, z: 0 };
    startCalibration();
    phase = 'calibrating';
    btnRec.textContent = 'Detener';
    btnRec.classList.add('active');
    statusEl.textContent = 'Calibrando: mantén el telefono quieto un momento...';
  } else if (phase === 'calibrating') {
    phase = 'idle';
    btnRec.textContent = 'Grabar';
    btnRec.classList.remove('active');
    statusEl.textContent = 'Cancelado.';
  } else {
    phase = 'idle';
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
    else msg += ' Recorrido estimado: ' + f(tr.dist) + ' m (' + tr.steps + ' pasos).';
    statusEl.textContent = msg;
  }
});

async function doExport(fileName) {
  if (poses.length < 2) { statusEl.textContent = 'Graba algo primero.'; return; }
  statusEl.textContent = 'Generando GLTF...';
  try {
    const blob = await exportToGLTF(poses);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    statusEl.textContent = 'Exportado ' + fileName + ': ' + poses.length + ' muestras.' +
      (rotChanged ? '' : ' Aviso: la rotacion es constante.') +
      (posChanged ? '' : ' Aviso: la posicion es constante.');
  } catch (e) {
    statusEl.textContent = 'Error al exportar: ' + e.message;
  }
}

btnExp.addEventListener('click', () => doExport('camera-track.gltf'));

startCamera();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
