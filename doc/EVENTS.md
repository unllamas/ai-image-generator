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
| `control` | string | Control afectado, por ejemplo `model`, `ratio`, `count`, `quality`, `advanced` o `provider`. |
| `value` | string | Valor normalizado del control afectado. |

### URL Presets

Los query params se usan para inicializar estado no sensible de la UI. No reemplazan a los eventos de analytics y no se actualizan en cada cambio del usuario.

Parametros soportados:

| Parametro | Ejemplo | Efecto |
| --- | --- | --- |
| `model` | `?model=google/gemini-3-pro-image` | Selecciona un modelo si existe en la UI. |
| `ratio` | `?ratio=9:16` | Selecciona aspect ratio si existe en la UI. |
| `count` | `?count=2` | Selecciona output count si existe en la UI. |
| `quality` | `?quality=high` | Selecciona calidad si existe en la UI. |
| `advanced` | `?advanced=1` | Abre el panel avanzado. |
| `settings` | `?settings=1` | Abre el modal de configuracion. |
| `access` | `?access=required#api-key` | Lleva a la seccion de opciones de acceso. |

Cuando un preset valido se aplica, el frontend emite `url_preset_applied` con `control` y `value`.

No deben existir presets para API keys, prompts, imagenes de referencia, imagenes generadas, data URLs ni payloads completos.

### Eventos

| Evento | Cuando ocurre | Parametros esperados |
| --- | --- | --- |
| `api_key_saved` | El usuario guarda la API key en localStorage. | Ninguno. |
| `url_preset_applied` | Un query param valido inicializa un control de UI. | Contexto frontend + `control`, `value`. |
| `advanced_options_toggle` | El usuario abre o cierra opciones avanzadas. | Contexto frontend + `action`. |
| `generation_option_changed` | Cambia aspect ratio, cantidad o calidad. | Contexto frontend + `control`, `value`. |
| `model_changed` | Cambia el modelo seleccionado. | Contexto frontend + `control`, `value`. |
| `provider_changed` | Cambia el provider en settings. | Contexto frontend + `control`, `value`. |
| `ui_interaction` | Click en un CTA/control marcado con `data-track`. | Contexto frontend + `action`. |
| `lead_cta_clicked` | Click en CTA externo de captacion. | Contexto frontend + `action`. |
| `reference_image_added` | Se agrega una imagen de referencia. | Contexto frontend. |
| `reference_image_removed` | Se elimina una imagen de referencia. | Contexto frontend. |
| `reference_image_rejected` | Una referencia no puede procesarse o supera el limite local. | Contexto frontend + `category`. |
| `reference_image_pasted` | Se pega una imagen desde clipboard en el prompt. | Contexto frontend + `image_count`. |
| `reference_upload_opened` | El usuario abre el selector de imagenes de referencia. | Contexto frontend. |
| `settings_opened` | Se abre el modal de settings. | Contexto frontend. |
| `settings_closed` | Se cierra el modal de settings. | Contexto frontend + `action`. |
| `access_options_prompted` | El usuario intenta generar sin provider/API key y se lo lleva a opciones de acceso. | Contexto frontend. |
| `generate_start` | Empieza una generacion. | Contexto frontend. |
| `generate_success` | La generacion termina correctamente. | Contexto frontend + `image_count`, `warnings_count`, `duration_ms`. |
| `generate_error` | La generacion falla. | Contexto frontend + `category`, `status`. |
| `image_downloaded` | El usuario descarga una imagen. | Contexto frontend. |
| `image_modal_opened` | El usuario abre una imagen en modal. | Contexto frontend. |
| `image_modal_closed` | El usuario cierra el modal de imagen. | Contexto frontend + `action`. |
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
- `responseDiagnostics` solo ante una respuesta multimodal vacia:
  - `finishReason`
  - `rawFinishReason`
  - `contentTypes`
  - `fileCount`
  - `fileMediaTypes`
  - `textLength`
  - `generationId` de AI Gateway

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
