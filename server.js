// ─────────────────────────────────────────────────────────────
// MVP Backend — Vercel AI Gateway (images)
// Node 18+ requerido (fetch/FormData/Blob nativos).
// Ejecutar: node server.js
// ─────────────────────────────────────────────────────────────
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const GATEWAY = 'https://ai-gateway.vercel.sh/v1';
const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID || '';
const SITE_URL = (process.env.SITE_URL || `http://${HOST}:${PORT}`).replace(/\/+$/, '');
const MAX_BODY_BYTES = 20 * 1024 * 1024;
const MAX_REFERENCE_IMAGES = 5;
const MAX_PROMPT_CHARS = 5000;
const WEBP_QUALITY = 82;
const SUPPORTED_LOCALES = new Set(['en', 'es']);

const LOCALES = {
  en: {
    lang: 'en',
    path: '/',
    ogLocale: 'en_US',
    ogLocaleAlternate: 'es_ES',
    title: 'AI Image Generator Playground | Compare GPT and Gemini Models',
    description:
      'Generate, edit, and compare AI images across GPT Image, Gemini, and future image providers from one multi-model playground.',
    keywords:
      'ai image generator, ai image playground, generate ai image, GPT image generator, Gemini image generator, multi model image generator',
    ogTitle: 'AI Image Generator Playground',
    active: {
      en: 'bg-white text-black',
      es: 'text-neutral-400 hover:text-white',
    },
    copy: {},
  },
  es: {
    lang: 'es',
    path: '/es/',
    ogLocale: 'es_ES',
    ogLocaleAlternate: 'en_US',
    title: 'Generador de Imágenes IA | Compará modelos GPT y Gemini',
    description:
      'Generá, editá y compará imágenes IA con GPT Image, Gemini y futuros proveedores desde un playground multi-modelo.',
    keywords:
      'generador de imagenes ia, crear imagenes ia, generador ia, GPT image generator, Gemini image generator, playground imagenes ia',
    ogTitle: 'Generador de Imágenes IA Playground',
    active: {
      en: 'text-neutral-400 hover:text-white',
      es: 'bg-white text-black',
    },
    copy: {
      'AI Image Generator Playground': 'Generador de Imágenes IA Playground',
      'Vercel AI Gateway API Key': 'API Key de Vercel AI Gateway',
      Save: 'Guardar',
      Saved: 'Guardada',
      'A cyberpunk astronaut walking through neon-lit Kyoto streets in the rain...':
        'Un astronauta cyberpunk caminando por calles de Kyoto iluminadas con neón bajo la lluvia...',
      'Advanced options': 'Opciones avanzadas',
      'Aspect Ratio': 'Aspect ratio',
      'Output count': 'Cantidad',
      Quality: 'Calidad',
      Generate: 'Generar',
      'Generated images will appear here': 'Las imágenes generadas aparecerán aquí',
      'Close image': 'Cerrar imagen',
      'Generated image preview': 'Previsualización de imagen generada',
      Model: 'Modelo',
      Prompt: 'Prompt',
      Language: 'Idioma',
      Resolution: 'Resolución',
      Size: 'Tamaño',
      Download: 'Descargar',
      Edit: 'Editar',
      'Generating image...': 'Generando imagen...',
      'You can use up to ': 'Podés usar hasta ',
      ' reference images.': ' imágenes de referencia.',
      'Unknown model': 'Modelo desconocido',
      'Not available': 'No disponible',
      'Enter your API key to generate images.': 'Ingresá tu API key para generar imágenes.',
      'Write a prompt.': 'Escribí un prompt.',
      'The prompt cannot exceed ': 'El prompt no puede superar ',
      ' characters.': ' caracteres.',
      'Unknown error': 'Error desconocido',
      Reason: 'Motivo',
      Details: 'Detalle',
    },
  },
};

const MODEL_CONFIGS = {
  'openai/gpt-image-2': {
    gatewayModel: 'openai/gpt-image-2',
    strategy: 'image-only',
    maxImages: 4,
    supportsSize: true,
    supportsAspectRatio: true,
    supportsProviderOptions: true,
    supportsReferenceImages: true,
  },
  'google/gemini-3-pro-image': {
    gatewayModel: 'google/gemini-3-pro-image',
    strategy: 'multimodal-files',
    maxImages: 4,
    supportsSize: false,
    supportsAspectRatio: false,
    usesPromptAspectRatio: true,
    supportsProviderOptions: false,
    supportsReferenceImages: true,
  },
  // Alias estable de la UI hacia el ID documentado por Vercel para Nano Banana 2.
  'google/gemini-3.1-flash-image': {
    gatewayModel: 'google/gemini-3.1-flash-image-preview',
    strategy: 'multimodal-files',
    maxImages: 4,
    supportsSize: false,
    supportsAspectRatio: false,
    usesPromptAspectRatio: true,
    supportsProviderOptions: false,
    supportsReferenceImages: true,
  },
  'google/gemini-3.1-flash-image-preview': {
    gatewayModel: 'google/gemini-3.1-flash-image-preview',
    strategy: 'multimodal-files',
    maxImages: 4,
    supportsSize: false,
    supportsAspectRatio: false,
    usesPromptAspectRatio: true,
    supportsProviderOptions: false,
    supportsReferenceImages: true,
  },
};

// Supported models: add an entry in MODEL_CONFIGS and in the front if it should appear in the UI.
const ALLOWED_MODELS = Object.keys(MODEL_CONFIGS);

const json = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

const localizedUrl = (locale) => `${SITE_URL}${LOCALES[locale].path === '/' ? '/' : LOCALES[locale].path}`;

const htmlEscape = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const applyCopy = (html, copy = {}) =>
  Object.entries(copy)
    .sort(([a], [b]) => b.length - a.length)
    .reduce((output, [from, to]) => output.replaceAll(from, to), html);

const acceptsSpanish = (req) => {
  const header = String(req.headers['accept-language'] || '').toLowerCase();
  if (!header) return false;
  const first = header.split(',')[0]?.trim() || '';
  return first === 'es' || first.startsWith('es-');
};

const resolveLocale = (pathname) => {
  if (pathname === '/es' || pathname.startsWith('/es/')) return 'es';
  return 'en';
};

const serveIndex = (res, locale = 'en') => {
  const config = LOCALES[SUPPORTED_LOCALES.has(locale) ? locale : 'en'];
  const canonicalUrl = localizedUrl(config.lang);
  let html = fs
    .readFileSync(path.join(__dirname, 'index.html'), 'utf8')
    .replaceAll('__SITE_URL__', SITE_URL)
    .replaceAll('__LANG__', config.lang)
    .replaceAll('__META_TITLE__', htmlEscape(config.title))
    .replaceAll('__META_DESCRIPTION__', htmlEscape(config.description))
    .replaceAll('__META_KEYWORDS__', htmlEscape(config.keywords))
    .replaceAll('__CANONICAL_URL__', canonicalUrl)
    .replaceAll('__EN_URL__', localizedUrl('en'))
    .replaceAll('__ES_URL__', localizedUrl('es'))
    .replaceAll('__OG_TITLE__', htmlEscape(config.ogTitle))
    .replaceAll('__OG_DESCRIPTION__', htmlEscape(config.description))
    .replaceAll('__OG_LOCALE__', config.ogLocale)
    .replaceAll('__OG_LOCALE_ALTERNATE__', config.ogLocaleAlternate)
    .replaceAll('__EN_ACTIVE_CLASS__', config.active.en)
    .replaceAll('__ES_ACTIVE_CLASS__', config.active.es)
    .replace('"__GA_MEASUREMENT_ID__"', JSON.stringify(GA_MEASUREMENT_ID));
  html = applyCopy(html, config.copy);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
};

const safeRequestContext = (payload = {}) => {
  const images = Array.isArray(payload.images) ? payload.images : [];
  const options =
    payload.options && typeof payload.options === 'object' && !Array.isArray(payload.options) ? payload.options : {};
  return {
    model: payload.model || '',
    aspectRatio: payload.aspectRatio || '',
    size: payload.size || '',
    count: Math.max(1, Math.min(Number(payload.n) || 1, 4)),
    hasReferences: images.length > 0,
    referenceCount: images.length,
    promptLength: typeof payload.prompt === 'string' ? payload.prompt.length : 0,
    optionProviders: Object.keys(options).sort(),
    quality: options.openai?.quality || '',
    outputFormat: options.openai?.outputFormat || '',
  };
};

const logBackendError = (error = {}, context = {}) => {
  console.warn(
    JSON.stringify({
      ts: new Date().toISOString(),
      event: 'image_generation_error',
      error: {
        category: error.category || 'unknown',
        status: error.status || 500,
        code: error.code || '',
        type: error.type || '',
        requestId: error.requestId || '',
        violations: error.violations || [],
      },
      context,
    }),
  );
};

const errorJson = (res, status, payload, context) => {
  logBackendError(payload.error || {}, context);
  return json(res, status, payload);
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
    message = 'Could not authenticate with Vercel AI Gateway. Check that the API key is valid and has permissions.';
  } else if (status === 404 || rawLower.includes('resource was not found')) {
    category = 'not_found';
    message = 'The requested endpoint or model is not available in Vercel AI Gateway.';
  } else if (status === 429) {
    category = 'rate_limit';
    message = 'The provider or gateway usage limit was reached. Try again in a few minutes.';
  } else if (status === 400 || status === 422) {
    category = 'bad_request';
    message = 'The provider rejected the submitted configuration. Check model, size, count, and advanced options.';
  }

  if (
    rawLower.includes('safety') ||
    rawLower.includes('safety_violations') ||
    code === 'content_policy_violation' ||
    type === 'image_generation_user_error'
  ) {
    category = 'safety';
    message =
      'The request was rejected by the provider safety system. Adjust the prompt or reference images.';
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
      violations: extractSafetyViolations(rawMessage),
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

const parseSize = (value) => {
  const match = String(value || '').match(/^(\d{2,5})x(\d{2,5})$/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
};

const parseAspectRatio = (value) => {
  const match = String(value || '').match(/^(\d{1,3}):(\d{1,3})$/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height, label: `${width}:${height}` };
};

const targetSizeFromAspectRatio = (aspectRatio, shortSide = 2048) => {
  const ratio = parseAspectRatio(aspectRatio);
  if (!ratio) return null;
  const round64 = (value) => Math.max(64, Math.round(value / 64) * 64);
  return ratio.width >= ratio.height
    ? { width: round64((shortSide * ratio.width) / ratio.height), height: shortSide }
    : { width: shortSide, height: round64((shortSide * ratio.height) / ratio.width) };
};

const outputTarget = (size, aspectRatio) => parseSize(size) || targetSizeFromAspectRatio(aspectRatio);

const withOutputTarget = async (sharpInput, target) => {
  if (!target) return sharpInput.webp({ quality: WEBP_QUALITY }).toBuffer();
  return sharpInput
    .resize({
      width: target.width,
      height: target.height,
      fit: 'cover',
      position: 'center',
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
};

const collectGeneratedFiles = async (files = [], target) => {
  const sharp = (await import('sharp')).default;
  const images = [];

  for (const file of files) {
    if (!file?.base64 && !file?.uint8Array) continue;
    if (file.mediaType && !file.mediaType.startsWith('image/')) continue;
    const input = file.uint8Array ? Buffer.from(file.uint8Array) : Buffer.from(file.base64, 'base64');
    const webp = await withOutputTarget(sharp(input), target);
    images.push(`data:image/webp;base64,${webp.toString('base64')}`);
  }

  return images;
};

const promptWithAspectRatio = (prompt, aspectRatio, size) => {
  const ratio = parseAspectRatio(aspectRatio);
  if (!ratio) return prompt;
  const dimensions = parseSize(size);
  const sizeInstruction = dimensions
    ? ` Final canvas must be ${dimensions.width}x${dimensions.height}px.`
    : '';
  return [
    prompt,
    '',
    'Output contract:',
    `- Generate exactly one image with a strict ${ratio.label} aspect ratio.${sizeInstruction}`,
    '- Match the canvas ratio directly; do not add letterboxing, pillarboxing, borders, frames, or padding.',
    '- Compose the scene for that canvas from the start, preserving the requested subject and style.',
  ].join('\n');
};

const buildMultimodalPrompt = (prompt, referenceImages = []) => {
  if (referenceImages.length === 0) return { prompt };
  return {
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...referenceImages.map((image) => ({
            type: 'image',
            image: image.buffer,
            mediaType: image.mime,
          })),
        ],
      },
    ],
  };
};

const resolveMaybePromise = async (value) => value;

const normalizeUsage = async (result = {}) => (await resolveMaybePromise(result.usage || result.totalUsage)) || null;

const generateImageOnly = async ({
  gateway,
  generateImage,
  modelConfig,
  prompt,
  referenceImages,
  size,
  aspectRatio,
  providerOptions,
  count,
}) => {
  const imagePrompt = referenceImages.length
    ? { text: prompt, images: referenceImages.map((image) => image.buffer) }
    : prompt;
  return generateImage({
    model: gateway.image(modelConfig.gatewayModel),
    prompt: imagePrompt,
    ...(modelConfig.supportsSize && size ? { size } : {}),
    ...(modelConfig.supportsAspectRatio && aspectRatio ? { aspectRatio } : {}),
    ...(modelConfig.supportsProviderOptions && Object.keys(providerOptions).length ? { providerOptions } : {}),
    maxImagesPerCall: 1,
    maxRetries: 1,
    n: count,
  });
};

const generateMultimodalFiles = async ({
  gateway,
  generateText,
  modelConfig,
  prompt,
  referenceImages,
  size,
  aspectRatio,
  count,
}) => {
  const allFiles = [];
  const warnings = [];
  const usages = [];
  const modelPrompt = modelConfig.usesPromptAspectRatio ? promptWithAspectRatio(prompt, aspectRatio, size) : prompt;

  for (let i = 0; i < count; i++) {
    const promptForCall =
      count === 1
        ? modelPrompt
        : `${modelPrompt}\n\nGenerate exactly one image. Variant ${i + 1} of ${count}.`;
    const result = await generateText({
      model: gateway.languageModel(modelConfig.gatewayModel),
      ...buildMultimodalPrompt(promptForCall, referenceImages),
      maxRetries: 1,
    });
    allFiles.push(...((await resolveMaybePromise(result.files)) || []));
    const resultWarnings = (await resolveMaybePromise(result.warnings)) || [];
    if (Array.isArray(resultWarnings)) warnings.push(...resultWarnings);
    usages.push(await normalizeUsage(result));
  }

  return {
    files: allFiles,
    usage: usages.length === 1 ? usages[0] : usages,
    warnings,
  };
};

const runImageGeneration = async (input) => {
  const { modelConfig, generateImage, generateText } = input;
  if (modelConfig.strategy === 'image-only') {
    const result = await generateImageOnly(input);
    return {
      files: (await resolveMaybePromise(result.images)) || [],
      usage: await normalizeUsage(result),
      warnings: (await resolveMaybePromise(result.warnings)) || [],
    };
  }
  if (modelConfig.strategy === 'multimodal-files') {
    if (!generateText) {
      throw new Error('The installed ai package version does not expose generateText.');
    }
    return generateMultimodalFiles(input);
  }
  throw new Error(`Unsupported generation strategy: ${modelConfig.strategy}`);
};

const normalizeSdkError = (err) => {
  const rawMessage = err?.message || String(err);
  const rawLower = rawMessage.toLowerCase();
  let category = 'gateway_error';
  let message = rawMessage || 'Error en el AI Gateway.';

  if (rawLower.includes('api key') || rawLower.includes('unauthorized') || rawLower.includes('authentication')) {
    category = 'auth';
    message = 'Could not authenticate with Vercel AI Gateway. Check that the API key is valid and has permissions.';
  } else if (rawLower.includes('not found') || rawLower.includes('no such model')) {
    category = 'not_found';
    message = 'The requested model is not available in Vercel AI Gateway.';
  } else if (rawLower.includes('rate limit') || rawLower.includes('too many requests')) {
    category = 'rate_limit';
    message = 'The provider or gateway usage limit was reached. Try again in a few minutes.';
  } else if (
    rawLower.includes('safety') ||
    rawLower.includes('safety_violations') ||
    rawLower.includes('content policy')
  ) {
    category = 'safety';
    message = 'The image could not be generated because the provider flagged the content as sensitive.';
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
  const url = new URL(req.url, SITE_URL);

  // ── Serve localized front ──
  if (req.method === 'GET' && ['/', '/index.html', '/es', '/es/'].includes(url.pathname)) {
    if (url.pathname === '/es') {
      res.writeHead(301, { Location: '/es/' });
      res.end();
      return;
    }
    if (url.pathname === '/' && url.searchParams.get('lang') !== 'en' && acceptsSpanish(req)) {
      res.writeHead(302, { Location: '/es/' });
      res.end();
      return;
    }
    serveIndex(res, resolveLocale(url.pathname));
    return;
  }

  // ── Generation endpoint ──
  if (req.method === 'POST' && url.pathname === '/api/generate') {
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
      const requestStartedAt = Date.now();
      let requestContext = {};
      const errorForRequest = (status, payload) =>
        errorJson(res, status, payload, {
          ...requestContext,
          durationMs: Date.now() - requestStartedAt,
        });

      try {
        if (tooLarge) {
          return errorForRequest(413, {
            error: {
              message: 'The request is too large. Reduce the number or size of reference images.',
              category: 'payload_too_large',
              status: 413,
            },
          });
        }

        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          return errorForRequest(400, {
            error: {
              message: 'The request body is not valid JSON.',
              category: 'bad_json',
              status: 400,
            },
          });
        }

        const { apiKey, model, prompt, size, aspectRatio, n = 1, images = [], options = {} } = parsed;
        requestContext = safeRequestContext(parsed);

        if (!apiKey) {
          return errorForRequest(401, {
            error: { message: 'API Key requerida.', category: 'auth', status: 401 },
          });
        }
        if (!prompt) {
          return errorForRequest(400, {
            error: { message: 'The prompt is required.', category: 'validation', status: 400 },
          });
        }
        if (prompt.length > MAX_PROMPT_CHARS) {
          return errorForRequest(400, {
            error: {
              message: `The prompt cannot exceed ${MAX_PROMPT_CHARS} characters.`,
              category: 'validation',
              status: 400,
            },
          });
        }
        if (!ALLOWED_MODELS.includes(model))
          return errorForRequest(400, {
            error: {
              message: `Unsupported model: ${model}`,
              category: 'validation',
              status: 400,
            },
          });

        if (!Array.isArray(images)) {
          return errorForRequest(400, {
            error: {
              message: 'Reference images must be sent as an array.',
              category: 'validation',
              status: 400,
            },
          });
        }

        if (images.length > MAX_REFERENCE_IMAGES) {
          return errorForRequest(400, {
            error: {
              message: `Maximum ${MAX_REFERENCE_IMAGES} reference images.`,
              category: 'validation',
              status: 400,
            },
          });
        }

        const referenceImages = [];
        for (const image of images) {
          const info = dataUrlInfo(image);
          if (!info) {
            return errorForRequest(400, {
              error: {
                message: 'Reference images must be valid base64 data URLs.',
                category: 'validation',
                status: 400,
              },
            });
          }
          referenceImages.push({
            buffer: Buffer.from(info.b64, 'base64'),
            mime: info.mime,
          });
        }

        const modelConfig = MODEL_CONFIGS[model];
        const count = Math.max(1, Math.min(Number(n) || 1, modelConfig.maxImages));
        const providerOptions = sanitizeOptions(options);

        let generateImage;
        let generateText;
        let createGateway;
        try {
          const ai = await import('ai');
          generateImage = ai.generateImage || ai.experimental_generateImage;
          generateText = ai.generateText;
          createGateway = ai.createGateway;
          if (!generateImage) {
            throw new Error('The installed ai package version does not expose generateImage.');
          }
          if (!generateText) {
            throw new Error('The installed ai package version does not expose generateText.');
          }
          if (!createGateway) {
            throw new Error('The installed ai package version does not expose createGateway.');
          }
        } catch (err) {
          return errorForRequest(500, {
            error: {
              message: 'The AI SDK dependency is missing. Run npm install before starting the server.',
              category: 'missing_dependency',
              status: 500,
              raw: err.message,
            },
          });
        }

        let result;
        try {
          const gateway = createGateway({ apiKey });
          result = await runImageGeneration({
            gateway,
            generateImage,
            generateText,
            modelConfig,
            prompt,
            referenceImages,
            size,
            aspectRatio,
            providerOptions,
            count,
          });
        } catch (err) {
          const payload = normalizeSdkError(err);
          return errorForRequest(err?.statusCode || err?.status || 500, payload);
        }

        const resultImages = (await collectGeneratedFiles(result.files, outputTarget(size, aspectRatio))).slice(0, count);
        if (resultImages.length === 0) {
          return errorForRequest(502, {
            error: {
              message: 'The gateway responded successfully, but did not return images.',
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
        errorForRequest(500, {
          error: {
            message: 'The generation could not be completed.',
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
    console.error(`Port ${PORT} is already in use.`);
  } else if (err.code === 'EPERM') {
    console.error(`No permission to listen on http://${HOST}:${PORT}.`);
  } else {
    console.error('Could not start the server:', err.message);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => console.log(`Server running at http://${HOST}:${PORT}`));
