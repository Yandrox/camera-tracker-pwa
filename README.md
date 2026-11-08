# Camera Tracker PWA (WebXR)

[![PWA](https://img.shields.io/badge/PWA-offline--ready-5A0FC8?logo=pwa&logoColor=white)](https://yandorx.github.io/camera-tracker-pwa/)
[![Platform](https://img.shields.io/badge/platform-Android-3DDC84?logo=android&logoColor=white)](#)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![No Build](https://img.shields.io/badge/build-none-success)](https://yandorx.github.io/camera-tracker-pwa/)

PWA ultraligera que convierte tu Android en una herramienta de **camera tracking** usando **WebXR** (ARCore) y **Three.js**. 

Graba el movimiento real de la cámara, visualiza la trayectoria en tiempo real y exporta la animación como un archivo `.glb` que puedes importar directamente en **Prisma3D**, Blender, Three.js o cualquier motor compatible con glTF.

---

## 🌐 Demo en vivo

**[Abrir Camera Tracker PWA](https://yandrox.github.io/camera-tracker-pwa/)**

> Abre el enlace en **Chrome para Android**. Pulsa "Iniciar AR", concede los permisos y comienza a grabar. Desde el menú del navegador puedes usar **"Añadir a pantalla de inicio"** para instalarla como app.

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

- **Tracking nativo con WebXR**: Utiliza el SLAM del propio dispositivo (ARCore) para obtener la posición y rotación exactas.
- **Cero dependencias externas (No CDNs)**: Todos los archivos (incluido Three.js) viven dentro del repositorio para garantizar el funcionamiento offline absoluto.
- **Grabación de trayectoria**: Guarda posición y cuaternión de rotación por cada frame.
- **Exportación a `.glb`**: Genera un archivo glTF binario con la animación de la cámara lista para Prisma3D.
- **100% offline**: Service Worker cachea todo desde la primera visita.
- **Sin build, sin npm, sin Termux**: Solo archivos estáticos. Editable directamente desde GitHub o Acode en tu móvil.
- **Compatible con WebToApp** para generar un APK sin PC.

---

## Uso rápido

1. Abre la PWA en Chrome (Android) desde [GitHub Pages](https://yandorx.github.io/camera-tracker-pwa/) o instala el [APK](https://github.com/Yandrox/camera-tracker-pwa/releases/latest).
2. Pulsa **▶ Iniciar AR** y concede los permisos de cámara.
3. Pulsa **● Grabar** y mueve el teléfono lentamente.
4. Pulsa **■ Detener** y luego **⬇ Exportar GLB**.
5. Importa el `.glb` en Prisma3D u otro motor 3D. La animación de la cámara ya está incluida.

---

##  Publicación y APK

El proyecto se sirve desde **GitHub Pages** (HTTPS gratis) y se empaqueta como APK con **WebToApp**.

### Generar tu propio APK con WebToApp

[WebToApp](https://github.com/shiaho777/web-to-app) es una herramienta de código abierto que convierte cualquier PWA en un APK **directamente desde tu Android**.

---

## Tecnologías

- **[WebXR Device API](https://www.w3.org/TR/webxr/)**: SLAM nativo del dispositivo (ARCore).
- **[Three.js](https://threejs.org/)**: Renderizado 3D y exportación a glTF (alojado localmente).
- **Service Worker + Web App Manifest**: Soporte PWA y modo offline.
- **[WebToApp](https://github.com/shiaho777/web-to-app)**: Empaquetado APK sin PC.

---

## Contribuir

Las mejoras son bienvenidas: forks, issues y PRs. Ideas pendientes:

☐ Alineación de escala con Prisma3D.
☐ Selector de frecuencia de muestreo (FPS de los keyframes).
☐ Exportación opcional a .fbx.
☐ Modo "solo nube de puntos" (exportar .ply).
☐ Traducciones (EN/ES).

---

## Licencia

MIT — libre para usar, modificar y compartir.

---

## ⭐ ¿Te gusta el proyecto?

¡Considera darle una estrella en GitHub!

Esto ayuda a que más personas descubran la herramienta.