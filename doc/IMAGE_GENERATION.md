# Image Generation Architecture

This document defines the current image generation model and the provider expansion strategy.

## Current Product Scope

AI Image Playground is a multi-model AI image generator interface.

Current capabilities:

- Text-to-image generation
- Reference-image generation/editing
- Multiple outputs per request
- Aspect ratio controls
- Quality/resolution controls
- Local image history
- Model metadata per generated image
- Download generated images as WebP

## Current Provider

The current backend provider layer is:

```text
Vercel AI Gateway
```

The user supplies their own Vercel AI Gateway API key. The key is sent only with the generation request and is not persisted by the backend.

## Current Models

| UI Model | Gateway Model | Strategy | Output |
| --- | --- | --- | --- |
| `openai/gpt-image-2` | `openai/gpt-image-2` | `generateImage` / image-only | `result.images` |
| `google/gemini-3-pro-image` | `google/gemini-3-pro-image` | `generateText` / multimodal files | `result.files` |
| `google/gemini-3.1-flash-image` | `google/gemini-3.1-flash-image-preview` | `generateText` / multimodal files | `result.files` |

## Generation Types

### Text To Image

The user writes a prompt and selects:

- Model
- Aspect ratio
- Output count
- Quality

The backend sends the request through the model strategy configured in `MODEL_CONFIGS`.

### Reference Image Generation

The user can upload generated or external images as references.

Reference image behavior:

- OpenAI image-only models receive image buffers in the image prompt.
- Gemini multimodal models receive image parts in the message content.

### Variants

The frontend supports `n` outputs.

OpenAI image-only strategy:

- Uses `n` directly in `generateImage`.

Gemini multimodal strategy:

- Uses one `generateText` call per requested variant.
- Adds a small variant instruction to the prompt.
- Collects returned images from `result.files`.

## Aspect Ratio Handling

OpenAI image-only models:

- Receive `size`.
- Receive `aspectRatio`.
- Receive provider options when supported.

Gemini multimodal models:

- Vercel AI Gateway exposes generation through `generateText`.
- The flow returns image files, not `generateImage` image outputs.
- The backend injects an explicit aspect ratio contract into the prompt.
- The final WebP is normalized with `sharp` to the requested output size or aspect ratio.

This gives the endpoint a consistent interface even when providers expose different image-generation primitives.

## Output Normalization

All generated images are converted to WebP:

```text
WEBP_QUALITY = 82
```

The backend filters multimodal files to process image files only.

## Model Registry

`MODEL_CONFIGS` is the source of truth for model support.

Each model declares:

- `gatewayModel`
- `strategy`
- `maxImages`
- `supportsSize`
- `supportsAspectRatio`
- `usesPromptAspectRatio`
- `supportsProviderOptions`
- `supportsReferenceImages`

This avoids hardcoding provider-specific behavior inside the request handler.

## Adding A New Model

1. Add a model entry to `MODEL_CONFIGS`.
2. Decide which strategy it uses.
3. Add it to the frontend select if it should be user-facing.
4. Add model label mapping in `modelLabel()`.
5. Validate reference image support.
6. Validate output shape.
7. Add provider-specific options only through a sanitized options object.

## Future Provider Integrations

Potential future providers:

- OpenRouter
- Replicate
- Fal
- Stability AI
- Runware
- Direct OpenAI API
- Direct Google Gemini API

Recommended provider architecture:

```text
Provider adapter -> Model strategy -> Normalized image output
```

Each adapter should normalize:

- Authentication
- Model ID
- Prompt structure
- Reference image structure
- Output image files
- Errors
- Usage/cost metadata

The frontend should not need to know whether a model runs on Vercel AI Gateway, OpenRouter, Replicate, or another provider.

## Safe Logging

Do not log:

- API keys
- Full prompts
- Reference images
- Generated images
- Base64 payloads
- Full provider responses if they contain user content

Allowed backend observability:

- Model
- Provider
- Strategy
- Aspect ratio
- Size
- Output count
- Reference image count
- Prompt length
- Error category
- HTTP status
- Request duration

## SEO Product Angles

Recommended long-tail pages:

```text
/ai-image-generator
/multi-model-ai-image-generator
/gpt-image-generator
/gemini-image-generator
/gpt-image-vs-gemini-image-generator
/ai-image-generator-with-api-key
/vercel-ai-gateway-image-generator
/openrouter-image-generator
```

The strongest positioning is:

```text
Multi-model AI image generator playground
```

This makes the product different from single-provider tools like Canva, Adobe Firefly, ChatGPT Images, or Midjourney.
