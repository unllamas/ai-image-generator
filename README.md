# AI Image Playground

MVP para generar imagenes con Vercel AI Gateway. El frontend guarda la API key del usuario en `localStorage`, permite configurar modelo/opciones de generacion y muestra un historial local en IndexedDB.

## Modelos soportados

- `openai/gpt-image-2`: modelo image-only via `generateImage`.
- `google/gemini-3-pro-image`: modelo multimodal via `generateText`, con imagenes devueltas en `result.files`.
- `google/gemini-3.1-flash-image`: alias de UI para `google/gemini-3.1-flash-image-preview`, tambien via `generateText`.

El backend usa un registry en `MODEL_CONFIGS` para que cada modelo declare su estrategia de generacion. Esto permite agregar modelos nuevos sin mezclar la logica especifica de cada proveedor en el endpoint.

Para modelos Gemini multimodales, Vercel AI Gateway expone la generacion por `generateText` y archivos en `result.files`. Como ese flujo no usa el mismo parametro nativo `aspectRatio` de los modelos image-only, el backend adapta el ratio de dos maneras:

- Agrega al prompt una instruccion explicita de canvas, aspect ratio y dimensiones solicitadas.
- Normaliza el WebP final con `sharp` al `size` enviado por el frontend, o al aspect ratio solicitado si no hay `size`.

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
SITE_URL=https://ai-image-generator.example.com npm start
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

## Idiomas

La app sirve ingles en `/` y español en `/es/`. Si el usuario entra a `/` con el navegador configurado en español, el servidor lo redirige a `/es/`, salvo que entre explicitamente con `?lang=en`.

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

Documentacion adicional:

- [Metadata y languages](doc/METADATA_AND_LANGS.md)
- [Generacion de imagenes](doc/IMAGE_GENERATION.md)

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
npm run check
npm start
```
