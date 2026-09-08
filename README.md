# Page Storage Extension

Extensión para navegador que permite inspeccionar y borrar rápidamente las cookies,
el local storage y el session storage del sitio actual. Pensada para desarrollo web.

Al igual que Page Timer, sólo actúa en los sitios que habilitas explícitamente,
así no interfiere con el resto de tu navegación.

## Características

- Lista cookies, local storage y session storage del origen actual
- Buscador que filtra por clave, valor o dominio en las tres secciones
- Copia el valor completo de cualquier entrada al portapapeles
- Edita valores en línea, tanto de cookies como de local/session storage
- Borra entradas individuales, una sección completa o todo de una vez
- Interruptor por sitio: la extensión sólo lee y borra donde la habilitas
- Badge con el número de entradas del sitio habilitado
- Botón de recarga para ver la página con el almacenamiento limpio
- Interfaz en español e inglés, con modo claro y oscuro

## Instalación

### Google Chrome

1. Abre Chrome y navega a `chrome://extensions/`
2. Activa el **Modo de desarrollador** (esquina superior derecha)
3. Haz clic en **Cargar extensión sin empaquetar**
4. Selecciona la carpeta `Chrome` de este proyecto
5. La extensión aparecerá en tu barra de herramientas

### Mozilla Firefox

1. Abre Firefox y navega a `about:debugging#/runtime/this-firefox`
2. Haz clic en **Cargar complemento temporal...**
3. Navega a la carpeta `Firefox` del proyecto
4. Selecciona el archivo `manifest.json`
5. La extensión se cargará temporalmente

> **Nota para Firefox:** Las extensiones temporales se eliminan al cerrar el navegador. Para una instalación permanente, necesitas firmar la extensión a través de [addons.mozilla.org](https://addons.mozilla.org).

## Uso

1. Abre la página cuyo almacenamiento quieres gestionar
2. Haz clic en el icono de la extensión
3. Activa **Gestionar este sitio** para el origen actual
4. Filtra con el buscador si hay muchas entradas; el contador de cada sección
   pasa a mostrar `coincidencias/total`
5. Actúa sobre cada fila con sus tres botones:
   - Copiar: pone el valor completo en el portapapeles
   - Lápiz: edita el valor en línea (`Escape` cancela)
   - `x`: elimina esa entrada
6. El icono de papelera de cada cabecera limpia esa sección, y **Limpiar todo**
   borra cookies y ambos almacenamientos
7. Usa **Recargar** para volver a cargar la página ya limpia

Las cookies mostradas son las que el navegador enviaría a la URL actual, incluidas
las de dominios padre. Los valores largos se recortan en la vista previa, pero al
copiarlos o editarlos siempre se trabaja con el valor completo. Al guardar una
cookie se conservan su dominio, ruta, expiración y banderas `secure`, `httpOnly`
y `sameSite`.

## Permisos

- `cookies` y `<all_urls>`: leer, editar y borrar cookies del sitio activo
- `scripting` y `activeTab`: leer, editar y limpiar local/session storage de la pestaña
- `tabs`: conocer la URL de la pestaña activa
- `storage`: recordar qué sitios has habilitado

La extensión no envía datos a ningún servidor.

## Estructura del Proyecto

```
PageStorageExtention/
├── Chrome/
│   ├── manifest.json
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── background/
│   │   └── service-worker.js
│   ├── icons/
│   └── _locales/
├── Firefox/
│   └── (misma estructura, manifest adaptado a Gecko)
└── README.md
```
