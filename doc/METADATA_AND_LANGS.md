# Metadata And Languages

This document defines the SEO metadata and language strategy for AI Image Playground.

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

The current `index.html` includes:

- `<html lang="en">`
- SEO title
- Meta description
- Robots directive
- Canonical URL
- `hreflang` alternates
- Open Graph metadata
- Twitter card metadata
- `WebApplication` JSON-LD
- Theme/color-scheme metadata
- Referrer policy metadata

## Environment Variables

`SITE_URL` is used by `server.js` to inject production URLs into metadata:

```bash
SITE_URL=https://ai-image-generator.example.com npm start
```

If `SITE_URL` is not set, the server falls back to the local host URL.

`GA_MEASUREMENT_ID` remains optional:

```bash
GA_MEASUREMENT_ID=G-XXXXXXXXXX npm start
```

## Canonical URL

Current canonical:

```html
<link rel="canonical" href="__SITE_URL__/" />
```

In production, this becomes:

```html
<link rel="canonical" href="https://ai-image-generator.example.com/" />
```

## Language Strategy

Recommended structure:

```text
/        English default
/es/     Spanish version
```

Use paths instead of query parameters for SEO-critical language pages.

Preferred:

```text
https://ai-image-generator.example.com/
https://ai-image-generator.example.com/es/
```

Avoid for primary SEO pages:

```text
/?lang=es
/?locale=es
```

Query params are acceptable for product preferences, debugging, and experiments, but language pages should have stable crawlable URLs.

## Hreflang

Current placeholders:

```html
<link rel="alternate" hreflang="en" href="__SITE_URL__/" />
<link rel="alternate" hreflang="es" href="__SITE_URL__/es/" />
<link rel="alternate" hreflang="x-default" href="__SITE_URL__/" />
```

When `/es/` exists, both English and Spanish pages must link to each other with reciprocal `hreflang` tags.

## Future Localization Plan

Phase 1:

- Keep the app UI in English.
- Add SEO docs and landing copy in English.
- Prepare `hreflang` placeholders.

Phase 2:

- Add `/es/` as a separate localized route/page.
- Translate only stable marketing and instructional copy.
- Keep generated image history local to the browser.

Phase 3:

- Add localized long-tail pages:

```text
/gpt-image-generator
/gemini-image-generator
/multi-model-ai-image-generator
/ai-image-generator-with-api-key
/es/generador-imagenes-ia
/es/generador-imagenes-ia-con-api-key
```

## Notes From Google Search Guidance

Google recommends:

- Use descriptive titles and snippets that help users understand the page.
- Use `hreflang` for localized versions.
- Use fully qualified URLs in `hreflang`.
- Keep language versions bidirectionally linked.
- Do not rely on `lang` or `hreflang` alone for language detection; page content still matters.

References:

- https://developers.google.com/search/docs/appearance/title-link
- https://developers.google.com/search/docs/appearance/snippet
- https://developers.google.com/search/docs/specialty/international/localized-versions
