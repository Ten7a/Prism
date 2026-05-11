# 00 — Foundations

## Goal

Strip the demo scaffolding, install the design tokens, and establish the global layout shell so every later step plugs into a clean, consistent surface.

## Touches

- `src/routes/+layout.svelte` — global shell (header, scanlines, vignette, main slot, footer).
- `src/routes/layout.css` — design tokens + reusable `@utility` blocks.
- `src/routes/+page.svelte` — replace demo content with a marketing landing.
- `src/app.html` — viewport, theme-color, font preload (JetBrains Mono).
- **Delete:** `src/lib/vitest-examples/`, `src/routes/demo/`.
- `static/fonts/` — self-hosted JetBrains Mono woff2 (avoids external CDN call for GDPR).
- `svelte.config.js` — switch adapter to `@sveltejs/adapter-cloudflare`; keep `adapter-node` available behind a `BUILD_TARGET=node` env switch for the Docker self-host path.
- `package.json` — `build:node` script that flips the env var.
- `vite.config.ts` — drop demo aliases if any.

## Reuses

- Token names and `@utility` patterns from [`../../Portfolio/astro/portfolio/src/styles/global.css`](../../Portfolio/astro/portfolio/src/styles/global.css): `--color-fg-*`, `--color-rule`, `--font-mono`, `sec`, `sec-head`, `chip`, `tag`, `glass`, `scanlines`, `vignette`, `row-base`, `row-hover-shift`.
- Existing Tailwind v4 setup in [`../svelte.config.js`](../svelte.config.js) and [`../vite.config.ts`](../vite.config.ts).

## Steps

1. Delete `src/lib/vitest-examples/` and `src/routes/demo/` (entire dirs).
2. Add JetBrains Mono woff2 files to `static/fonts/jetbrains-mono-{regular,medium}.woff2` and `@font-face` them in `layout.css` with `font-display: swap`.
3. Port the design tokens (`@theme` block) and utilities listed above into `src/routes/layout.css`. Drop portfolio-specific bits (`hero-h1-fx`, `hob-scroll`).
4. Build `+layout.svelte`:
   - Header: `PRISM` wordmark left, nav (`Generate`, `Library`, `Account`) right, monospace, 1px bottom rule.
   - Body: `<main class="has-rules-rails">{@render children()}</main>`.
   - Overlays: `<div class="scanlines" />` + `<div class="vignette" />` (skip when `prefers-reduced-motion: reduce`).
   - Footer: legal links (`Privacy`, `Terms`), `© Prism` mono small.
5. Replace `+page.svelte` with a hero ("Generate images, mono and direct.") + 3-step "How it works" using `sec` utility.
6. Update `svelte.config.js` to default to `adapter-cloudflare`. Add a conditional that uses `adapter-node` when `process.env.BUILD_TARGET === 'node'`.
7. Update `package.json` scripts: `"build:node": "BUILD_TARGET=node vite build"`.

## Tests

Add to `src/routes/landing.spec.ts`:

```ts
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';
import { expect, test } from 'vitest';

test('landing renders headline and three-step section', async () => {
	const screen = render(Page);
	await expect.element(screen.getByRole('heading', { level: 1 })).toBeVisible();
	await expect.element(screen.getByText(/how it works/i)).toBeVisible();
});

test('skips overlays when reduced-motion is requested', async () => {
	// mock matchMedia to return reduced-motion=true and assert .scanlines is absent
});
```

Add to `e2e/foundations.test.ts`:

```ts
import { expect, test } from '@playwright/test';

test('navigation reaches all top-level routes', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('link', { name: /generate/i })).toBeVisible();
	await page.getByRole('link', { name: /library/i }).click();
	await expect(page).toHaveURL(/\/library/);
});

test('layout renders scanlines overlay', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('.scanlines')).toHaveCount(1);
});
```

Edge case: assert that `BUILD_TARGET=node npm run build` produces a `build/` dir with a `index.js` entry (smoke check via a CI script — not a vitest case).

## Verify

```bash
npm run check
npm run test:unit -- --run
npm run test:e2e
npm run dev   # confirm landing renders, header links work
BUILD_TARGET=node npm run build:node && ls build/
```

Acceptance: landing page is mono/B+W, scanlines visible, no demo routes resolve (they 404), both Cloudflare and Node builds succeed.
