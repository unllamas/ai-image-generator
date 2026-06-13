# Events And Observability

Este documento define que eventos se trackean, que parametros estan permitidos y que datos no deben registrarse.

## Principios

- No registrar API keys.
- No registrar prompts completos.
- No registrar imagenes, data URLs ni base64.
- No registrar payloads completos.
- Preferir conteos, flags, categorias y duraciones.
- Mantener una whitelist de parametros permitidos.

## Configuracion De Google Analytics

Google Analytics se activa solamente si existe un Measurement ID.

Desde entorno:

```bash
GA_MEASUREMENT_ID=G-XXXXXXXXXX npm start
```

Desde query param para pruebas:

```text
/?ga_id=G-XXXXXXXXXX
```

Debug local:

```text
/?analytics_debug=1
```

## Frontend

La funcion `trackEvent(name, params)` filtra todos los parametros con una whitelist antes de llamar a `gtag`.

Parametros permitidos:

| Parametro | Tipo | Descripcion |
| --- | --- | --- |
| `model` | string | Modelo seleccionado. |
| `aspect_ratio` | string | Ratio seleccionado, por ejemplo `1:1`. |
| `quality` | string | Calidad seleccionada: `low`, `medium`, `high`. |
| `resolution` | string | Resolucion derivada: `1K`, `2K`, `4K`. |
| `output_count` | number | Cantidad solicitada de imagenes. |
| `reference_count` | number | Cantidad de imagenes de referencia. |
| `has_references` | boolean | Indica si hay referencias cargadas. |
| `advanced_open` | boolean | Indica si el panel avanzado esta abierto. |
| `image_count` | number | Cantidad de imagenes devueltas. |
| `warnings_count` | number | Cantidad de warnings devueltos por el proveedor. |
| `duration_ms` | number | Duracion de la generacion desde el frontend. |
| `category` | string | Categoria de error normalizada. |
| `status` | number | HTTP status del error. |
| `action` | string | Accion puntual, por ejemplo `open` o `close`. |

### Eventos

| Evento | Cuando ocurre | Parametros esperados |
| --- | --- | --- |
| `api_key_saved` | El usuario guarda la API key en localStorage. | Ninguno. |
| `advanced_options_toggle` | El usuario abre o cierra opciones avanzadas. | Contexto frontend + `action`. |
| `generation_option_changed` | Cambia aspect ratio, cantidad o calidad. | Contexto frontend. |
| `model_changed` | Cambia el modelo seleccionado. | Contexto frontend. |
| `reference_image_added` | Se agrega una imagen de referencia. | Contexto frontend. |
| `reference_image_removed` | Se elimina una imagen de referencia. | Contexto frontend. |
| `generate_start` | Empieza una generacion. | Contexto frontend. |
| `generate_success` | La generacion termina correctamente. | Contexto frontend + `image_count`, `warnings_count`, `duration_ms`. |
| `generate_error` | La generacion falla. | Contexto frontend + `category`, `status`. |
| `image_downloaded` | El usuario descarga una imagen. | Contexto frontend. |
| `image_modal_opened` | El usuario abre una imagen en modal. | Contexto frontend. |
| `image_edit_started` | El usuario usa una imagen generada como referencia. | Contexto frontend. |

### Datos Prohibidos En Frontend Analytics

- `apiKey`
- `prompt`
- `images`
- `src`
- `base64`
- Data URLs
- Respuestas completas del proveedor

## Backend

El backend no envia eventos a GA. Para produccion, emite logs JSON estructurados con `console.warn` cuando ocurre un error de generacion o validacion.

Forma general:

```json
{
  "ts": "2026-01-01T00:00:00.000Z",
  "event": "image_generation_error",
  "error": {
    "category": "validation",
    "status": 400,
    "code": "",
    "type": "",
    "requestId": "",
    "violations": []
  },
  "context": {
    "model": "openai/gpt-image-2",
    "aspectRatio": "1:1",
    "size": "2048x2048",
    "count": 1,
    "hasReferences": false,
    "referenceCount": 0,
    "promptLength": 120,
    "optionProviders": ["openai"],
    "quality": "medium",
    "outputFormat": "webp",
    "durationMs": 2350
  }
}
```

### Categorias De Error

| Categoria | Significado |
| --- | --- |
| `auth` | API key faltante, invalida o sin permisos. |
| `validation` | Error de validacion local. |
| `bad_json` | Body invalido. |
| `payload_too_large` | Request demasiado grande. |
| `bad_request` | El proveedor rechazo la configuracion. |
| `not_found` | Endpoint o modelo no disponible. |
| `rate_limit` | Limite de uso alcanzado. |
| `safety` | Rechazo por politicas de seguridad del proveedor. |
| `missing_dependency` | Falta dependencia requerida. |
| `empty_response` | El proveedor no devolvio imagenes. |
| `gateway_error` | Error generico del gateway o SDK. |
| `server_error` | Error no controlado del servidor. |

### Contexto Seguro En Backend

Campos permitidos:

- `model`
- `aspectRatio`
- `size`
- `count`
- `hasReferences`
- `referenceCount`
- `promptLength`
- `optionProviders`
- `quality`
- `outputFormat`
- `durationMs`

Campos prohibidos:

- `apiKey`
- `prompt`
- `images`
- Buffers de imagen
- Base64
- Payload completo
- Respuesta completa del proveedor si contiene contenido del usuario

## Extension Futura

Si se integra Sentry, Axiom, Datadog, Logtail u otro proveedor, mantener estas mismas funciones como frontera:

- Frontend: `trackEvent()`
- Backend: `logBackendError()`

La integracion con proveedores debe ocurrir detras de esas funciones para conservar la whitelist y evitar filtraciones accidentales.
