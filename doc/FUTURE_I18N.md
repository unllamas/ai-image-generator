# Future I18n

This document preserves the localization approach explored during development so the feature can be reintroduced later without rediscovering the same decisions.

The current product intentionally supports English only. This document is not active implementation documentation; it is a blueprint for a future localization feature.

## Why It Was Removed

Localization was removed from the first production pass to reduce support surface:

- No multi-language QA matrix.
- No risk of partial UI translations.
- No duplicated SEO pages before the product positioning is stable.
- No language-specific routing, canonical, or `hreflang` maintenance.

The approach itself was useful and should be reused if localization becomes a product requirement.

## Core Decision

Use one translation contract shared by server-rendered HTML and frontend runtime behavior.

Metadata must be part of that same contract. SEO title, description, keywords, Open Graph fields, canonical path, and `hreflang` data should not be maintained separately from UI copy once multiple languages are supported.

Avoid:

- Translating by `replaceAll()` over English phrases.
- Keeping visible copy hardcoded in JavaScript.
- Maintaining one system for static HTML and another for dynamic modals/errors.
- Letting language selection depend only on query params.

Prefer:

- Stable dotted keys.
- Locale files per language.
- Server-rendered localized metadata and first paint.
- The same dictionary injected into the frontend for dynamic UI.
- Automated validation against every locale.

## File Structure

Recommended structure:

```text
locales/
  en.json
  es.json
scripts/
  check-i18n.js
```

Each locale file should own both metadata and UI copy:

```json
{
  "lang": "en",
  "path": "/",
  "ogLocale": "en_US",
  "ogLocaleAlternate": "es_ES",
  "title": "AI Image Generator Playground | Compare GPT and Gemini Models",
  "description": "Generate, edit, and compare AI images across GPT Image, Gemini, and future image providers from one multi-model playground.",
  "keywords": "ai image generator, ai image playground, generate ai image",
  "ogTitle": "AI Image Generator Playground",
  "ui": {
    "page": {
      "hero": {
        "title": "AI Image Generator Playground",
        "description": "Generate and compare images across GPT Image, Gemini, and future AI providers in one focused workspace."
      }
    }
  }
}
```

The metadata fields should be treated as required fields, not optional extras:

```text
lang
path
ogLocale
ogLocaleAlternate
title
description
keywords
ogTitle
```

Localized pages should render these fields server-side so crawlers receive the correct title, description, canonical URL, Open Graph locale, and JSON-LD description on first response.

## Key Naming

Use section-based dotted keys:

```text
brand.name
nav.settings
page.hero.title
page.hero.description
prompt.placeholder
prompt.drop.title
settings.default.title
settings.default.description
settings.onboarding.title
settings.onboarding.description
settings.onboarding.question
settings.onboarding.details
gallery.preview
gallery.generating
actions.generate
errors.emptyPrompt
```

Runtime state should get explicit key branches. For example, the settings modal should not reuse generic labels for onboarding:

```text
settings.default.title
settings.default.description
settings.onboarding.title
settings.onboarding.description
```

This prevents first-run flows from falling back to raw keys such as `settings.onboarding.title`.

## HTML Contract

Static text can use server-rendered tokens:

```html
<h1>__T_page.hero.title__</h1>
```

Attributes need their own explicit markers:

```html
<textarea
  placeholder="__T_prompt.placeholder__"
  data-i18n-placeholder="prompt.placeholder"
></textarea>
```

For visible text, `data-i18n` can support client-side re-application when needed:

```html
<button data-i18n="actions.generate">__T_actions.generate__</button>
```

## Frontend Runtime

The server should inject the selected locale dictionary:

```html
<script>
  window.APP_CONFIG = {
    locale: "en"
  };
  window.APP_I18N = { /* locale.ui */ };
</script>
```

Use a small helper:

```js
function valueAtPath(source, dottedPath) {
  return dottedPath.split('.').reduce((value, part) => {
    return value && value[part] !== undefined ? value[part] : undefined;
  }, source);
}

function t(key, params = {}) {
  const value = valueAtPath(window.APP_I18N || {}, key);
  const template = typeof value === 'string' ? value : key;
  return Object.entries(params).reduce((output, [param, replacement]) => {
    return output.replaceAll(`{${param}}`, String(replacement));
  }, template);
}
```

Dynamic UI should use `t()`:

```js
settingsTitle.textContent = t('settings.onboarding.title');
showError(t('errors.promptTooLong', { max: 5000 }));
```

## Server Rendering

The server should:

- Load locale JSON files at startup.
- Resolve locale from the pathname.
- Render metadata from the locale file.
- Render localized canonical, alternate, Open Graph, Twitter, and JSON-LD fields from the locale file.
- Replace `__T_*__` tokens from `locale.ui`.
- Inject `window.APP_I18N`.
- Serve localized URLs through stable paths.

Recommended paths:

```text
/      English
/es/   Spanish
```

Avoid using query params as canonical language pages:

```text
/?lang=es
/?locale=es
```

Query params are acceptable for debugging and experiments, not primary SEO pages.

## Routing And SEO

When localization is active:

- `/` serves English.
- `/es/` serves Spanish.
- `/es` redirects to `/es/`.
- Each language has its own canonical URL.
- Each language includes reciprocal `hreflang` tags.
- `x-default` points to `/`.
- A language switcher links to stable language paths.

Example:

```html
<link rel="alternate" hreflang="en" href="https://example.com/" />
<link rel="alternate" hreflang="es" href="https://example.com/es/" />
<link rel="alternate" hreflang="x-default" href="https://example.com/" />
```

Browser language detection can be added, but it should not replace crawlable URLs. If used, redirect only from `/` and allow an explicit English override.

## Validation

Add a script:

```json
{
  "scripts": {
    "check:i18n": "node scripts/check-i18n.js"
  }
}
```

The validator should check:

- Locale JSON parses.
- Required metadata exists in every locale.
- Every `__T_*__` token exists in every locale.
- Every `data-i18n*` key exists in every locale.
- Every static `t('...')` key exists in every locale.
- Supported dynamic key patterns are expanded and checked.
- All locale files have the same `ui` key shape.
- Simulated server-rendered HTML for every locale has no unresolved tokens.
- `window.APP_I18N` is injected as a non-empty dictionary.
- Visible raw keys such as `settings.onboarding.title` do not appear in rendered HTML.

This check is important because key-existence alone is not enough. A page can have valid locale files and still show raw keys if server injection fails or the app is opened directly via `file://`.

## Known Failure Modes

Raw keys visible in the UI usually mean one of these happened:

- The page was opened through `file://`, bypassing server injection.
- A dynamic UI branch uses a key not present in the locale.
- `window.APP_I18N` was not injected.
- The HTML token was added without updating locale files.
- The validator only checked locale files and did not simulate final render.

## Reintroduction Checklist

1. Restore `locales/en.json` and the target locale files.
2. Restore server locale loading and route resolution.
3. Restore `__T_*__` token rendering in `index.html`.
4. Restore `window.APP_I18N` injection.
5. Restore the frontend `t(key, params)` helper.
6. Replace dynamic English constants with `t()` only where UI is language-dependent.
7. Restore `/es/` or other locale routes.
8. Restore reciprocal `hreflang`.
9. Restore a language switcher in the nav.
10. Add `npm run check:i18n`.
11. Run visual QA for each locale.

Until this checklist is implemented, keep the production app English-only.
