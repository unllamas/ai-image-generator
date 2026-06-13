# AI Image Playground

MVP para generar imagenes con Vercel AI Gateway. El frontend guarda la API key del usuario en `localStorage`, permite configurar modelo/opciones de generacion y muestra un historial local en IndexedDB.

## Requisitos

- Node.js 18+
- Una API key valida de Vercel AI Gateway

## Instalacion

```bash
npm install
```

## Ejecucion local

```bash
npm start
```

Por defecto el servidor escucha en:

```text
http://127.0.0.1:3000
```

Variables utiles:

```bash
PORT=3001 npm start
HOST=0.0.0.0 npm start
```

## Google Analytics

Google Analytics es opcional. Para activarlo, iniciar el servidor con `GA_MEASUREMENT_ID`:

```bash
GA_MEASUREMENT_ID=G-XXXXXXXXXX npm start
```

El backend inyecta ese ID en `index.html`. Si la variable no esta configurada, no se carga Google Analytics ni se envian eventos.

Para pruebas locales tambien se puede usar:

```text
http://127.0.0.1:3000/?ga_id=G-XXXXXXXXXX
```

Y para ver los eventos en consola:

```text
http://127.0.0.1:3000/?analytics_debug=1
```

## Privacidad

La instrumentacion esta pensada para produccion sin exponer informacion sensible.

No se envia a analytics ni a logs:

- API key
- Prompt completo
- Imagenes de referencia
- Imagenes generadas
- Data URLs/base64
- Payload completo del request

El frontend usa una whitelist en `trackEvent()` para limitar los parametros permitidos. El backend usa `safeRequestContext()` para registrar solo metadata tecnica y errores normalizados.

## Eventos y logs

La documentacion completa esta en [doc/EVENTS.md](doc/EVENTS.md).

Resumen:

- Frontend: eventos de uso enviados a GA con parametros seguros.
- Backend: errores emitidos como logs JSON por `console.warn`.

## Produccion

Config minima recomendada:

- Definir `GA_MEASUREMENT_ID` solo en ambientes donde se quiera medir uso.
- Configurar `PORT` y `HOST` segun el runtime.
- Enviar stdout/stderr a la plataforma de logs elegida.
- Mantener la API key del usuario fuera del backend persistente; actualmente se envia solo por request y no se loguea.

## Scripts

```bash
npm start
```
