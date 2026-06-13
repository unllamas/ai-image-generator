// ─────────────────────────────────────────────────────────────
// MVP Backend — Vercel AI Gateway (imágenes)
// Node 18+ requerido (fetch/FormData/Blob nativos). Sin dependencias.
// Ejecutar: node server.js
// ─────────────────────────────────────────────────────────────
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const GATEWAY = 'https://ai-gateway.vercel.sh/v1';
const MAX_BODY_BYTES = 20 * 1024 * 1024;
const MAX_REFERENCE_IMAGES = 3;
const MAX_PROMPT_CHARS = 5000;
const WEBP_QUALITY = 82;
const IMAGE_ONLY_MODELS = new Set(['openai/gpt-image-2']);

// Modelos soportados (escalable: solo agregar aquí y en el front)
const ALLOWED_MODELS = ['openai/gpt-image-2', 'google/gemini-3.1-flash-image', 'google/gemini-3-pro-image'];

const json = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

const extractMessage = (data) => {
  if (!data) return '';
  if (typeof data.error === 'string') return data.error;
  if (data.error?.message) return data.error.message;
  if (data.message) return data.message;
  return '';
};

const extractRequestId = (headers, data, message) => {
  const headerId = headers.get('x-request-id') || headers.get('x-vercel-id') || headers.get('cf-ray') || '';
  if (headerId) return headerId;
  const match = String(message || '').match(/request ID\s+([A-Za-z0-9_-]+)/i);
  return match ? match[1] : data?.error?.request_id || data?.request_id || '';
};

const normalizeGatewayError = (status, data, headers) => {
  const rawMessage = extractMessage(data) || 'Error en el AI Gateway.';
  const requestId = extractRequestId(headers, data, rawMessage);
  const rawLower = rawMessage.toLowerCase();
  const code = data?.error?.code || data?.code || '';
  const type = data?.error?.type || data?.type || '';

  let category = 'gateway_error';
  let message = rawMessage;

  if (status === 401 || status === 403) {
    category = 'auth';
    message = 'No se pudo autenticar con Vercel AI Gateway. Revisá que la API key sea válida y tenga permisos.';
  } else if (status === 404 || rawLower.includes('resource was not found')) {
    category = 'not_found';
    message = 'El endpoint o modelo solicitado no está disponible en Vercel AI Gateway.';
  } else if (status === 429) {
    category = 'rate_limit';
    message = 'Se alcanzó el límite de uso del proveedor o del gateway. Probá nuevamente en unos minutos.';
  } else if (status === 400 || status === 422) {
    category = 'bad_request';
    message = 'El proveedor rechazó la configuración enviada. Revisá modelo, tamaño, cantidad y opciones avanzadas.';
  }

  if (
    rawLower.includes('safety') ||
    rawLower.includes('safety_violations') ||
    code === 'content_policy_violation' ||
    type === 'image_generation_user_error'
  ) {
    category = 'safety';
    message =
      'La solicitud fue rechazada por el sistema de seguridad del proveedor. Ajustá el prompt o las imágenes de referencia.';
  }

  return {
    error: {
      message,
      category,
      status,
      requestId,
      raw: rawMessage,
      code,
      type,
    },
  };
};

const dataUrlInfo = (value) => {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  return { mime: match[1], b64: match[2] };
};

const sanitizeOptions = (options) => {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return {};
  const blocked = new Set(['model', 'prompt', 'apiKey', 'images']);
  return Object.fromEntries(Object.entries(options).filter(([key]) => !blocked.has(key)));
};

const extractSafetyViolations = (message) => {
  const match = String(message || '').match(/safety_violations=\[([^\]]+)\]/i);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const collectGeneratedFiles = async (files = []) => {
  const sharp = (await import('sharp')).default;
  const images = [];

  for (const file of files) {
    if (!file?.base64 && !file?.uint8Array) continue;
    const input = file.uint8Array ? Buffer.from(file.uint8Array) : Buffer.from(file.base64, 'base64');
    const webp = await sharp(input).webp({ quality: WEBP_QUALITY }).toBuffer();
    images.push(`data:image/webp;base64,${webp.toString('base64')}`);
  }

  return images;
};

const normalizeSdkError = (err) => {
  const rawMessage = err?.message || String(err);
  const rawLower = rawMessage.toLowerCase();
  let category = 'gateway_error';
  let message = rawMessage || 'Error en el AI Gateway.';

  if (rawLower.includes('api key') || rawLower.includes('unauthorized') || rawLower.includes('authentication')) {
    category = 'auth';
    message = 'No se pudo autenticar con Vercel AI Gateway. Revisá que la API key sea válida y tenga permisos.';
  } else if (rawLower.includes('not found') || rawLower.includes('no such model')) {
    category = 'not_found';
    message = 'El modelo solicitado no está disponible en Vercel AI Gateway.';
  } else if (rawLower.includes('rate limit') || rawLower.includes('too many requests')) {
    category = 'rate_limit';
    message = 'Se alcanzó el límite de uso del proveedor o del gateway. Probá nuevamente en unos minutos.';
  } else if (
    rawLower.includes('safety') ||
    rawLower.includes('safety_violations') ||
    rawLower.includes('content policy')
  ) {
    category = 'safety';
    message = 'No pudimos generar esta imagen porque el proveedor marcó el contenido como sensible.';
  }

  return {
    error: {
      message,
      category,
      status: err?.statusCode || err?.status || 500,
      requestId:
        err?.requestId ||
        err?.responseHeaders?.['x-request-id'] ||
        extractRequestId(new Headers(), {}, rawMessage) ||
        '',
      raw: rawMessage,
      code: err?.code || '',
      type: err?.name || '',
      violations: extractSafetyViolations(rawMessage),
    },
  };
};

const server = http.createServer((req, res) => {
  // ── Servir el front ──
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
    return;
  }

  // ── Endpoint de generación ──
  if (req.method === 'POST' && req.url === '/api/generate') {
    let body = '';
    let tooLarge = false;
    req.on('data', (chunk) => {
      if (tooLarge) return;
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        tooLarge = true;
        body = '';
      }
    });
    req.on('end', async () => {
      try {
        if (tooLarge) {
          return json(res, 413, {
            error: {
              message: 'La solicitud es demasiado grande. Reducí la cantidad o tamaño de las imágenes de referencia.',
              category: 'payload_too_large',
              status: 413,
            },
          });
        }

        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          return json(res, 400, {
            error: {
              message: 'El cuerpo de la solicitud no es JSON válido.',
              category: 'bad_json',
              status: 400,
            },
          });
        }

        const { apiKey, model, prompt, size, aspectRatio, n = 1, images = [], options = {} } = parsed;

        if (!apiKey) {
          return json(res, 401, {
            error: { message: 'API Key requerida.', category: 'auth', status: 401 },
          });
        }
        if (!prompt) {
          return json(res, 400, {
            error: { message: 'El prompt es obligatorio.', category: 'validation', status: 400 },
          });
        }
        if (prompt.length > MAX_PROMPT_CHARS) {
          return json(res, 400, {
            error: {
              message: `El prompt no puede superar ${MAX_PROMPT_CHARS} caracteres.`,
              category: 'validation',
              status: 400,
            },
          });
        }
        if (!ALLOWED_MODELS.includes(model))
          return json(res, 400, {
            error: {
              message: `Modelo no soportado: ${model}`,
              category: 'validation',
              status: 400,
            },
          });

        if (!Array.isArray(images)) {
          return json(res, 400, {
            error: {
              message: 'Las imágenes de referencia deben enviarse como un array.',
              category: 'validation',
              status: 400,
            },
          });
        }

        if (images.length > MAX_REFERENCE_IMAGES) {
          return json(res, 400, {
            error: {
              message: `Máximo ${MAX_REFERENCE_IMAGES} imágenes de referencia.`,
              category: 'validation',
              status: 400,
            },
          });
        }

        const referenceImages = [];
        for (const image of images) {
          const info = dataUrlInfo(image);
          if (!info) {
            return json(res, 400, {
              error: {
                message: 'Las imágenes de referencia deben ser data URLs base64 válidas.',
                category: 'validation',
                status: 400,
              },
            });
          }
          referenceImages.push(Buffer.from(info.b64, 'base64'));
        }

        const count = Math.max(1, Math.min(Number(n) || 1, 4));
        const providerOptions = sanitizeOptions(options);
        const imagePrompt = referenceImages.length ? { text: prompt, images: referenceImages } : prompt;

        if (!IMAGE_ONLY_MODELS.has(model)) {
          return json(res, 400, {
            error: {
              message: `El modelo ${model} todavía no está implementado en este flujo del AI SDK.`,
              category: 'validation',
              status: 400,
            },
          });
        }

        let generateImage;
        let createGateway;
        try {
          const ai = await import('ai');
          generateImage = ai.generateImage || ai.experimental_generateImage;
          createGateway = ai.createGateway;
          if (!generateImage) {
            throw new Error('La versión instalada de ai no expone generateImage.');
          }
          if (!createGateway) {
            throw new Error('La versión instalada de ai no expone createGateway.');
          }
        } catch (err) {
          return json(res, 500, {
            error: {
              message: 'Falta instalar la dependencia del AI SDK. Ejecutá npm install antes de iniciar el servidor.',
              category: 'missing_dependency',
              status: 500,
              raw: err.message,
            },
          });
        }

        let result;
        try {
          const gateway = createGateway({ apiKey });
          result = await generateImage({
            model: gateway.image(model),
            prompt: imagePrompt,
            ...(size ? { size } : {}),
            ...(aspectRatio ? { aspectRatio } : {}),
            ...(Object.keys(providerOptions).length ? { providerOptions } : {}),
            maxImagesPerCall: 1,
            maxRetries: 1,
            n: count,
          });
        } catch (err) {
          return json(res, err?.statusCode || err?.status || 500, normalizeSdkError(err));
        }

        const resultImages = await collectGeneratedFiles(result.images);
        if (resultImages.length === 0) {
          return json(res, 502, {
            error: {
              message: 'El gateway respondió correctamente, pero no devolvió imágenes.',
              category: 'empty_response',
              status: 502,
              warnings: result.warnings || [],
            },
          });
        }

        json(res, 200, {
          images: resultImages,
          usage: result.usage || null,
          warnings: result.warnings || [],
        });
      } catch (err) {
        json(res, 500, {
          error: {
            message: 'No se pudo completar la generación.',
            category: 'server_error',
            status: 500,
            raw: err.message,
          },
        });
      }
    });
    return;
  }

  json(res, 404, { error: 'Not found' });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ El puerto ${PORT} ya está en uso.`);
  } else if (err.code === 'EPERM') {
    console.error(`❌ No hay permisos para escuchar en http://${HOST}:${PORT}.`);
  } else {
    console.error('❌ No se pudo iniciar el servidor:', err.message);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => console.log(`✅ Servidor en http://${HOST}:${PORT}`));
