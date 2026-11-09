# Camera Tracker PWA

[![PWA](https://img.shields.io/badge/PWA-offline--ready-5A0FC8?logo=pwa&logoColor=white)](https://yandrox.github.io/camera-tracker-pwa/)
[![Platform](https://img.shields.io/badge/platform-Android-3DDC84?logo=android&logoColor=white)](#)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![No Build](https://img.shields.io/badge/build-none-success)](https://yandrox.github.io/camera-tracker-pwa/)

PWA ultraligera que convierte tu Android en una herramienta de captura de movimiento de cámara. Utiliza exclusivamente los sensores internos del dispositivo (giroscopio y acelerómetro) para generar trayectorias y exportarlas como archivos `.gltf` listos para importar en Prisma3D, Blender, Three.js o cualquier motor compatible con glTF 2.0.

El proyecto no tiene dependencias externas: el exportador glTF está implementado en JavaScript puro, sin librerías, sin CDNs y sin build.

---

## Demo en vivo

**[Abrir Camera Tracker PWA](https://yandrox.github.io/camera-tracker-pwa/)**

> Abre el enlace en **Chrome para Android**. Desde el menú del navegador puedes usar la opción "Añadir a pantalla de inicio" para instalarla como una aplicación nativa.

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

> **Nota:** para que los sensores funcionen, se recomienda abrir la PWA directamente en **Chrome para Android**. Las WebView genéricas (APKs creadas con WebToApp u otras herramientas) pueden no entregar eventos de `deviceorientation`/`devicemotion`. La app incluye un panel **Info** con diagnóstico que te dice por qué no llegan los sensores en tu entorno concreto.

---

## Características

- **Cero dependencias externas (No ARCore, No WebXR, No CDNs, No Three.js)**: Funciona en cualquier Android con un navegador moderno. El exportador glTF está escrito en JavaScript puro y vive dentro del propio repositorio.
- **Seguimiento por sensores (IMU)**: Utiliza el giroscopio para una rotación precisa y el acelerómetro para estimar la traslación.
- **Grabación de trayectoria**: Guarda la posición y el cuaternión de rotación en cada instante de la grabación (muestreo a ~30 Hz).
- **Exportación a `.gltf`**: Genera un archivo glTF 2.0 en JSON con la animación de la cámara (translation + rotation) lista para su uso. La estructura del archivo sigue el mismo orden de buffers que usa Prisma3D.
- **Panel de diagnóstico integrado**: Botón **Info** con contadores de eventos del giroscopio y acelerómetro, estado de HTTPS, si la app corre en WebView o instalada, estado de los permisos de sensores y un consejo concreto según el entorno detectado (iOS, WebView, Brave, permisos denegados, etc.).
- **Gestión de permisos en iOS**: La solicitud de permisos de `DeviceOrientationEvent` y `DeviceMotionEvent` se lanza en el mismo gesto de usuario (al pulsar **Grabar**) para cumplir con la política de Safari en iOS 13+.
- **100% offline**: Service Worker cachea todos los recursos desde la primera visita.
- **Sin build, sin npm, sin Termux**: Solo archivos estáticos. Editable directamente desde GitHub o Acode en tu móvil.
- **Compatible con WebToApp** para generar un APK sin necesidad de una PC.

---

## Uso rápido

1. Abre la PWA en Chrome (Android) desde [GitHub Pages](https://yandrox.github.io/camera-tracker-pwa/) o instala el [APK](https://github.com/Yandrox/camera-tracker-pwa/releases/).
2. Pulsa **Grabar** y concede los permisos de cámara y sensores cuando el navegador lo solicite.
3. Mueve el teléfono lentamente realizando el movimiento que deseas capturar.
4. Pulsa **Detener** y luego **Exportar**.
5. Importa el archivo `.gltf` en Prisma3D u otro motor 3D. La animación de la cámara (translación + rotación) ya está incluida.

> Si al grabar el estado indica **"SIN datos de giroscopio"** o **"SIN datos de acelerometro"**, pulsa el botón **Info** para ver el diagnóstico del entorno y el consejo concreto para tu caso. Consulta también la sección [Problemas conocidos](#problemas-conocidos) más abajo.

---

## Limitaciones y Advertencias (Importante)

Debido a la naturaleza del hardware de los teléfonos móviles, esta herramienta presenta ciertas limitaciones técnicas que debes conocer:

- **Deriva a partir de los 30 segundos (Drift)**: La posición física se calcula integrando matemáticamente la aceleración (navegación inercial). Este método acumula pequeños errores en cada ciclo. Después de aproximadamente 20 o 30 segundos de grabación, el error de posición se vuelve notable y la trayectoria generada comenzará a desviarse de la realidad. Se recomienda grabar clips de corta duración (10 a 30 segundos).
- **Escala arbitraria**: El archivo exportado no está en unidades métricas reales (metros). La escala dependerá de la calibración de los sensores de tu dispositivo específico. Al importarlo a Prisma3D, es posible que necesites ajustar la escala del objeto.
- **Rotación vs Traslación**: La rotación (giroscopio) es muy precisa. La traslación (movimiento en X, Y, Z) es una estimación y puede presentar pequeños temblores (ruido) si mueves el teléfono de forma brusca.
- **Entorno**: Aunque el procesamiento es por sensores, la cámara debe estar despejada para que puedas ver el entorno. Mueve el teléfono de forma suave y constante para obtener los mejores resultados.
- **HTTPS obligatorio**: La API de sensores y la cámara solo funcionan en contexto seguro. La app se sirve desde GitHub Pages (HTTPS). Abrir el `index.html` localmente con `file://` **no** hará funcionar los sensores.

---

## Problemas conocidos

El acceso a los sensores de movimiento (`deviceorientation` y `devicemotion`) no está garantizado en todos los navegadores ni en todos los contextos. Estos son los casos más habituales:

### Brave (Android)
Brave **bloquea los sensores de movimiento por defecto** como parte de su política de privacidad.[reference:1] El evento `deviceorientation` puede dispararse una sola vez con valores `null` y no volver a emitirse.[reference:2]

**Solución:** Activa manualmente los sensores en `Ajustes > Configuración de sitios > Sensores de movimiento` y permite el acceso para el sitio de la PWA. Tras ello, recarga la página y vuelve a pulsar **Grabar**.[reference:3]

> Desactivar Brave Shields **no** soluciona este problema; es un ajuste independiente del bloqueo de sensores.[reference:4]

### Safari (iOS 13 y posteriores)
Safari exige una llamada explícita a `DeviceOrientationEvent.requestPermission()` / `DeviceMotionEvent.requestPermission()` **dentro de un gesto real del usuario** (por ejemplo, un toque en un botón). Si se solicita fuera de un gesto, los eventos no se disparan o la promesa se rechaza.

**Solución:** La PWA ya lanza ambas peticiones al pulsar **Grabar**, que es un gesto de usuario válido. Si el usuario denegó el permiso en el pasado, Safari no volverá a preguntar: hay que ir a `Ajustes > Safari > Borrar historial y datos` (o restablecer los permisos del sitio) y recargar la página. El panel **Info** detecta este caso y muestra el consejo correspondiente.

### Firefox (Android)
Firefox en Android soporta `deviceorientation` y `devicemotion`, pero el manejo de coordenadas y de la gravedad puede diferir del de Chrome. Además, al igual que en iOS, los permisos pueden requerir una interacción previa del usuario.[reference:6] Si los datos llegan pero la orientación parece "girada" o la traslación es incoherente, prueba a comparar con Chrome para descartar una diferencia de ejes del motor del navegador.

### WebView y APKs empaquetadas (WebToApp y similares)
Las WebView genéricas **no siempre entregan eventos de sensores** aunque el navegador del sistema sí lo haga. Esto afecta a APKs generadas con WebToApp u otras herramientas que simplemente envuelven la URL. El panel **Info** muestra si la app se está ejecutando en WebView (`WebView: si`) y, en ese caso, recomienda abrir la URL directamente en Chrome.[reference:7]

### Permisos de sensores denegados a nivel de navegador o sistema
Si el usuario (o una política corporativa) ha denegado el acceso a "Sensores de movimiento" para el sitio, los eventos no llegarán aunque el hardware esté disponible. El panel **Info** consulta `navigator.permissions` para `accelerometer` y `gyroscope` y muestra su estado (`granted`, `denied` o `n/d`).[reference:8]

**Solución en Chrome:** pulsa el candado de la barra de direcciones > Permisos > Sensores de movimiento = Permitir, y recarga.

### Sensores desactivados en el sistema
Algunos Android permiten desactivar el giroscopio o el acelerómetro desde los ajustes rápidos o desde el modo de ahorro extremo. En ese caso ningún navegador recibirá eventos. Comprueba que los sensores están activos en los ajustes del dispositivo.

> En todos estos casos, el botón **Info** de la PWA muestra un mensaje concreto con la acción recomendada para el entorno detectado, además de los contadores de eventos y el estado de los permisos.

---

## Publicación y APK

El proyecto se sirve desde GitHub Pages (HTTPS gratis) y se empaqueta como APK con WebToApp.

### Generar tu propio APK con WebToApp

WebToApp es una herramienta de código abierto que convierte cualquier PWA en un APK directamente desde tu Android.

1. Descarga e instala WebToApp desde su repositorio.
2. Abre la app y crea un nuevo proyecto.
3. Pega la URL pública de tu PWA: `https://yandrox.github.io/camera-tracker-pwa/`
4. Configura el nombre de la app (Camera Tracker), el icono y el color de tema (`#0f172a`).
5. Pulsa Build y espera a que se genere el APK.
6. Súbelo a la sección de Releases de este repositorio.

---

## Tecnologías

- **DeviceOrientation API**: Captura de datos del giroscopio para la rotación. Conversión de Euler (alpha, beta, gamma) a cuaternión con orden YXZ + corrección de −90° en X para orientación vertical con cámara trasera.
- **DeviceMotion API**: Captura de la aceleración para la estimación de posición. Si el dispositivo solo entrega `accelerationIncludingGravity`, la gravedad se estima con un filtro exponencial y se resta.
- **Integración inercial**: La aceleración se rota al marco del mundo con el cuaternión actual, se integra a velocidad y luego a posición, con un ligero factor de amortiguación (`exp(-1.5·dt)`) y zona muerta de 0.05 m/s² para reducir el ruido.
- **Exportador glTF 2.0 propio**: Generación manual de `accessors`, `bufferViews`, `buffers` (en base64), `nodes`, `animations` y `meshes`. Sin Three.js ni ninguna librería externa.
- **Service Worker + Web App Manifest**: Soporte PWA y modo offline absoluto.
- **WebToApp**: Empaquetado APK sin PC.

---

## Contribuir

Las mejoras son bienvenidas: forks, issues y PRs. Ideas pendientes:

- [ ] Aplicar un filtro de Kalman o Madgwick para mejorar la estabilidad de la traslación y reducir la deriva.
- [ ] Alineación de escala automática con Prisma3D.
- [ ] Selector de frecuencia de muestreo (FPS de los keyframes).
- [ ] Exportación opcional a `.glb` (glTF binario) además de `.gltf`.
- [ ] Exportación opcional a `.fbx`.
- [ ] Traducciones (EN/ES).

---

## Licencia

MIT. Libre para usar, modificar y compartir.

---

## ⭐ ¿Te gusta el proyecto?

¡Considera darle una estrella en GitHub!

Esto ayuda a que más personas descubran la herramienta.