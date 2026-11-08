# Camera Tracker PWA

[![PWA](https://img.shields.io/badge/PWA-offline--ready-5A0FC8?logo=pwa&logoColor=white)](https://yandrox.github.io/camera-tracker-pwa/)
[![Platform](https://img.shields.io/badge/platform-Android-3DDC84?logo=android&logoColor=white)](#)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![No Build](https://img.shields.io/badge/build-none-success)](https://yandrox.github.io/camera-tracker-pwa/)

PWA ligera que convierte tu Android en una herramienta de **camera tracking** basada en SLAM monocular.

Graba el movimiento real de la cámara, ve el mapa de puntos en tiempo real y exporta la trayectoria como un archivo `.glb` que puedes importar directamente en **Prisma3D**, Blender, Three.js o cualquier motor compatible con glTF.

---

## Demo en vivo

**[Abrir Camera Tracker PWA](https://yandrox.github.io/camera-tracker-pwa/)**

> Abre el enlace en **Chrome para Android**. Concede permisos de cámara. Desde el menú del navegador puedes usar **"Añadir a pantalla de inicio"** para instalarla como app.

---

## Descargar APK

Si prefieres la experiencia nativa, descarga el APK ya compilado desde la sección de **Releases**:

**[Descargar última versión (APK)](https://github.com/Yandrox/camera-tracker-pwa/releases/)**

> El APK se genera automáticamente desde esta PWA usando **WebToApp**, empaquetando la versión web en un contenedor nativo Android. El código fuente del APK es exactamente el mismo que el de la rama `main` de este repositorio.

**Instalación:**
1. Descarga el archivo `CameraTracker-vX.X.X.apk` desde Releases.
2. En tu Android, ve a **Ajustes → Seguridad → Instalar apps desconocidas** y permite la instalación desde el navegador o gestor de archivos que uses.
3. Abre el APK descargado y pulsa **Instalar**.
4. Listo. La app funciona **100% offline** (el Service Worker cachea todo en la primera carga).

---

## Características

- **SLAM en tiempo real** gracias a [AlvaAR](https://github.com/luoxz-ai/AlvaAR) (WebAssembly).
- **Mapa de puntos visual** superpuesto al video (los puntos verdes que reconoces del suelo).
- **Grabación de trayectoria** con posición y rotación por cada frame.
- **Exportación a `.glb`** (glTF binario) con la animación de la cámara lista para importar.
- **100% offline** tras la primera carga (Service Worker).
- **Sin build, sin npm, sin Termux**: solo archivos estáticos. Editable desde el propio móvil con Acode o la web de GitHub.
- **Compatible con WebToApp** para generar un APK sin PC.

---

## Uso rápido

1. Abre la PWA en Chrome (Android) desde [GitHub Pages](https://yandorx.github.io/camera-tracker-pwa/) o instala el [APK](https://github.com/Yandrox/camera-tracker-pwa/releases/latest).
2. Concede permisos de cámara.
3. Pulsa **● Grabar** y mueve el teléfono lentamente. Verás los puntos verdes de SLAM.
4. Pulsa **■ Detener** y luego **⬇ Exportar GLB**.
5. Importa el `.glb` en Prisma3D u otro motor 3D. La animación de la cámara ya está incluida.

---

## Publicación

El proyecto se sirve desde **GitHub Pages** (HTTPS gratis) y se empaqueta como APK con **WebToApp**.

---

## Tecnologías

- [AlvaAR](https://github.com/luoxz-ai/AlvaAR) — SLAM visual en WASM.
- [Three.js](https://threejs.org/) — construcción de la animación y exportación glTF.
- Service Worker + Web App Manifest — soporte PWA / offline.
- [WebToApp](https://github.com/shiaho777/web-to-app) — empaquetado APK sin PC.

---

## Contribuir

Las mejoras son bienvenidas: forks, issues y PRs. Ideas pendientes:

- [ ] Alineación de escala con Prisma3D.
- [ ] Selector de frecuencia de muestreo (FPS de los keyframes).
- [ ] Exportación opcional a `.fbx`.
- [ ] Modo "solo nube de puntos" (exportar `.ply`).
- [ ] Traducciones (EN/ES).

---

## Topics

`pwa` · `android` · `slam` · `camera-tracking` · `threejs` · `gltf` · `glb` · `prisma3d` · `augmented-reality` · `webassembly` · `offline-first` · `alvaar` · `webtoapp`

---

## Licencia

MIT — libre para usar, modificar y compartir.