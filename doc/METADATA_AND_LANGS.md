# Metadata

This document defines the SEO metadata strategy for AI Image Playground.

## Primary Positioning

Primary keyword:

```text
ai image generator
```

Product/category positioning:

```text
AI Image Generator Playground
```

Differentiation:

```text
Generate, edit, and compare AI images across multiple models and providers in one workflow.
```

This avoids competing only as a generic single-provider image generator. The product should rank around multi-model and provider-comparison use cases over time.

## Implemented Metadata

The current static `index.html` metadata includes:

- `<html lang="en">`
- SEO title
- Meta description
- Keywords
- Robots directive
- Canonical URL
- `x-default` alternate URL
- Open Graph metadata
- Twitter card metadata
- `WebApplication` JSON-LD
- Theme/color-scheme metadata
- Referrer policy metadata

## Landing Content Strategy

The page keeps the generator as the first screen and uses the space below the gallery for SEO and conversion content.

Current content sections:

- Multi-model AI image generator positioning.
- Short explanation of what the project does.
- How it works in three steps.
- Pricing-style access cards: self-managed API key vs managed hosted access.
- Compact provider coverage chips with current and future image provider candidates.
- Hosted access waitlist CTA for users without a provider account.
- Use cases for visual exploration.
- FAQ about API keys, storage, providers, and hosted access.

Primary funnel:

```text
Technical user -> Connect supported provider API key -> Generate images
Non-technical user -> Request hosted access -> Tally waitlist
```

Current provider status shown on the page:

```text
Supported today:
- Vercel AI Gateway

Future candidates:
- OpenAI direct
- Google Gemini direct
- OpenRouter
- fal
- Black Forest Labs
- Replicate / Stability AI
```

The provider table should stay conservative. Only mark a provider as supported when the backend has a working implementation and the UI can route requests to it.

The Tally links currently use:

```text
https://tally.so/r/kdpE8J
```

If the form changes, update the landing CTA and settings/onboarding references together.

Most metadata is written directly in `index.html` because the current product only supports English. The server only injects environment-dependent values:

- `__SITE_URL__`
- `GA_MEASUREMENT_ID`

## Language Strategy

The application now supports English only.

Static copy lives directly in `index.html`. Dynamic copy related to image generation, placeholders, errors, and generated-image actions lives in frontend constants inside the inline script.

There is no locale folder, language switcher, `hreflang` language alternates, or browser language redirect.

Legacy Spanish paths redirect to the English canonical page:

```text
/es  -> /
/es/ -> /
```

## Environment Variables

`SITE_URL` is used by `server.js` to inject production URLs into canonical, Open Graph URL, JSON-LD URL, and header links:

```bash
SITE_URL=https://ai-image-generator.example.com npm start
```

If `SITE_URL` is not set, the server falls back to the local host URL.

`GA_MEASUREMENT_ID` remains optional:

```bash
GA_MEASUREMENT_ID=G-XXXXXXXXXX npm start
```

## Canonical URL

Current canonical tag:

```html
<link rel="canonical" href="__SITE_URL__/" />
```

In production, this becomes:

```html
<link rel="canonical" href="https://ai-image-generator.example.com/" />
```

## Functional Query Params

The app supports query params for non-sensitive UI presets and onboarding flows:

```text
?model=google/gemini-3-pro-image
?ratio=9:16
?count=2
?quality=high
?advanced=1
?settings=1
?access=required#api-key
```

These params are not SEO landing pages. They should not change the canonical URL, metadata, Open Graph tags, JSON-LD, or language handling.

Rules:

- Use params to initialize UI state, QA links, or campaign defaults.
- Use analytics events to measure behavior after page load.
- Validate param values against existing UI options before applying them.
- Never accept API keys, prompts, reference images, generated images, data URLs, or full request payloads in the URL.
- Keep the canonical URL pointing to `/` so crawlers do not treat every preset combination as a separate page.

## Future Localization

If localization is reintroduced later, treat it as a new feature with explicit requirements:

- Restore locale files.
- Restore stable language paths.
- Add reciprocal `hreflang`.
- Add a language switcher.
- Add validation that checks the rendered HTML for every locale.

The detailed implementation blueprint is documented in [Future I18n](FUTURE_I18N.md).

Until then, the product surface and SEO metadata should remain English-only.
