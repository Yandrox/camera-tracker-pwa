# 📱 Camera Tracker PWA

PWA ligera que convierte tu Android en una herramienta de **camera tracking** basada en SLAM monocular.

Graba el movimiento real de la cámara, ve el mapa de puntos en tiempo real y exporta la trayectoria como un archivo `.glb` que puedes importar directamente en **Prisma3D**, Blender, Three.js o cualquier motor compatible con glTF.

---

## ✨ Características

- 🎥 **SLAM en tiempo real** gracias a [AlvaAR](https://github.com/luoxz-ai/AlvaAR) (WebAssembly).
- 🟢 **Mapa de puntos visual** superpuesto al video (los puntos verdes que reconoces del suelo).
- 📼 **Grabación de trayectoria** con posición y rotación por cada frame.
- 📦 **Exportación a `.glb`** (glTF binario) con la animación de la cámara lista para importar.
- 📴 **100% offline** tras la primera carga (Service Worker).
- 🧱 **Sin build, sin npm, sin Termux**: solo archivos estáticos. Editable desde el propio móvil con Acode o la web de GitHub.
- 🚀 **Compatible con WebToApp** para generar un APK sin PC.

---

## 🚀 Uso rápido

1. Abre la PWA en Chrome (Android) desde GitHub Pages.
2. Concede permisos de cámara.
3. Pulsa **● Grabar** y mueve el teléfono lentamente. Verás los puntos verdes de SLAM.
4. Pulsa **■ Detener** y luego **⬇ Exportar GLB**.
5. Importa el `.glb` en Prisma3D u otro motor 3D. La animación de la cámara ya está incluida.

---

## 🌐 Publicación

El proyecto está pensado para servirse desde **GitHub Pages** (HTTPS gratis) y empaquetarse como APK con [WebToApp](https://github.com/shiaho777/web-to-app).

---

## 🛠️ Tecnologías

- [AlvaAR](https://github.com/luoxz-ai/AlvaAR) — SLAM visual en WASM.
- [Three.js](https://threejs.org/) — construcción de la animación y exportación glTF.
- Service Worker + Web App Manifest — soporte PWA / offline.

---

## 🤝 Contribuir

Las mejoras son bienvenidas: forks, issues y PRs. Ideas pendientes:

- [ ] Alineación de escala con Prisma3D.
- [ ] Selector de frecuencia de muestreo (FPS de los keyframes).
- [ ] Exportación opcional a `.fbx`.
- [ ] Modo "solo nube de puntos" (exportar `.ply`).
- [ ] Traducciones (EN/ES).

---

## 📄 Licencia

MIT — libre para usar, modificar y compartir.