# Camera Tracker PWA

[![PWA](https://img.shields.io/badge/PWA-offline--ready-5A0FC8?logo=pwa&logoColor=white)](https://yandorx.github.io/camera-tracker-pwa/)
[![Platform](https://img.shields.io/badge/platform-Android-3DDC84?logo=android&logoColor=white)](#)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![No Build](https://img.shields.io/badge/build-none-success)](https://yandorx.github.io/camera-tracker-pwa/)

PWA ultraligera que convierte tu Android en una herramienta de captura de movimiento de cámara. Utiliza exclusivamente los sensores internos del dispositivo (giroscopio y acelerómetro) junto con Three.js para generar trayectorias y exportarlas como archivos `.glb` listos para importar en Prisma3D, Blender, Three.js o cualquier motor compatible con glTF.

---

## Demo en vivo

**[Abrir Camera Tracker PWA](https://yandorx.github.io/camera-tracker-pwa/)**

> Abre el enlace en Chrome para Android. Desde el menú del navegador puedes usar la opción "Añadir a pantalla de inicio" para instalarla como una aplicación nativa.

---

## Descargar APK

Si prefieres la experiencia nativa, descarga el APK ya compilado desde la sección de Releases:

**[Descargar ultima version (APK)](https://github.com/Yandrox/camera-tracker-pwa/releases/)**

> El APK se genera automáticamente desde esta PWA usando WebToApp, empaquetando la versión web en un contenedor nativo Android. El código fuente del APK es exactamente el mismo que el de la rama `main` de este repositorio.

**Instalación:**
1. Descarga el archivo `CameraTracker-vX.X.X.apk` desde Releases.
2. En tu Android, ve a Ajustes > Seguridad > Instalar apps desconocidas y permite la instalación desde el navegador o gestor de archivos.
3. Abre el APK descargado y pulsa Instalar.
4. Listo. La app funciona 100% offline (el Service Worker cachea todo en la primera carga).

---

## Características

- **Cero dependencias externas (No ARCore, No WebXR, No CDNs)**: Funciona en cualquier Android con un navegador moderno. Todos los archivos (incluido Three.js) viven dentro del repositorio.
- **Seguimiento por sensores (IMU)**: Utiliza el giroscopio para una rotación precisa y el acelerómetro para estimar la traslación.
- **Grabación de trayectoria**: Guarda la posición y el cuaternión de rotación en cada instante de la grabación.
- **Exportación a `.glb`**: Genera un archivo glTF binario con la animación de la cámara lista para su uso.
- **100% offline**: Service Worker cachea todo desde la primera visita.
- **Sin build, sin npm, sin Termux**: Solo archivos estáticos. Editable directamente desde GitHub o Acode en tu móvil.
- **Compatible con WebToApp** para generar un APK sin necesidad de una PC.

---

## Uso rápido

1. Abre la PWA en Chrome (Android) desde [GitHub Pages](https://yandorx.github.io/camera-tracker-pwa/) o instala el [APK](https://github.com/Yandrox/camera-tracker-pwa/releases/).
2. Pulsa **Grabar** y concede los permisos de cámara y sensores cuando el navegador lo solicite.
3. Mueve el teléfono lentamente realizando el movimiento que deseas capturar.
4. Pulsa **Detener** y luego **Exportar GLB**.
5. Importa el archivo `.glb` en Prisma3D u otro motor 3D. La animación de la cámara ya está incluida.

---

## Limitaciones y Advertencias (Importante)

Debido a la naturaleza del hardware de los teléfonos móviles, esta herramienta presenta ciertas limitaciones técnicas que debes conocer:

- **Deriva a partir de los 30 segundos (Drift)**: La posición física se calcula integrando matemáticamente la aceleración (navegación inercial). Este método acumula pequeños errores en cada ciclo. Después de aproximadamente 20 o 30 segundos de grabación, el error de posición se vuelve notable y la trayectoria generada comenzará a desviarse de la realidad. Se recomienda grabar clips de corta duración (10 a 30 segundos).
- **Escala arbitraria**: El archivo exportado no está en unidades métricas reales (metros). La escala dependerá de la calibración de los sensores de tu dispositivo específico. Al importarlo a Prisma3D, es posible que necesites ajustar la escala del objeto.
- **Rotación vs Traslación**: La rotación (giroscopio) es muy precisa. La traslación (movimiento en X, Y, Z) es una estimación y puede presentar pequeños temblores (ruido) si mueves el teléfono de forma brusca.
- **Entorno**: Aunque el procesamiento es por sensores, la cámara debe estar despejada para que puedas ver el entorno. Mueve el teléfono de forma suave y constante para obtener los mejores resultados.

---

## Publicación y APK

El proyecto se sirve desde GitHub Pages (HTTPS gratis) y se empaqueta como APK con WebToApp.

### Generar tu propio APK con WebToApp

WebToApp es una herramienta de código abierto que convierte cualquier PWA en un APK directamente desde tu Android.

1. Descarga e instala WebToApp desde su repositorio.
2. Abre la app y crea un nuevo proyecto.
3. Pega la URL pública de tu PWA: `https://yandorx.github.io/camera-tracker-pwa/`
4. Configura el nombre de la app (Camera Tracker), el icono y el color de tema (`#0f172a`).
5. Pulsa Build y espera a que se genere el APK.
6. Súbelo a la sección de Releases de este repositorio.

---

## Tecnologías

- **DeviceOrientation API**: Captura de datos del giroscopio para la rotación.
- **DeviceMotion API**: Captura de la aceleración para la estimación de posición.
- **Three.js**: Renderizado 3D y exportación a glTF (alojado localmente en el repositorio).
- **Service Worker + Web App Manifest**: Soporte PWA y modo offline absoluto.
- **WebToApp**: Empaquetado APK sin PC.

---

## Contribuir

Las mejoras son bienvenidas: forks, issues y PRs. Ideas pendientes:

- [ ] Aplicar un filtro de Kalman o Madgwick para mejorar la estabilidad de la traslación y reducir la deriva.
- [ ] Alineación de escala automática con Prisma3D.
- [ ] Selector de frecuencia de muestreo (FPS de los keyframes).
- [ ] Exportación opcional a .fbx.
- [ ] Traducciones (EN/ES).

---

## Licencia

MIT. Libre para usar, modificar y compartir.

---

## ⭐ ¿Te gusta el proyecto?

¡Considera darle una estrella en GitHub!

Esto ayuda a que más personas descubran la herramienta.