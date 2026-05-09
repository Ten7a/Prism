# 11 — Design system

## Goal

Crystallise the recurring UI primitives into a small, well-tested component library with a dev-only gallery so future pages stop reinventing styling.

## Touches

- `src/lib/ui/Button.svelte`
- `src/lib/ui/Chip.svelte`
- `src/lib/ui/Tag.svelte`
- `src/lib/ui/SectionHeader.svelte`
- `src/lib/ui/RuleRow.svelte`
- `src/lib/ui/Field.svelte` (label + input/textarea/select)
- `src/lib/ui/Modal.svelte`
- `src/lib/ui/Toast.svelte` + `src/lib/stores/toast.ts`
- `src/lib/ui/Spinner.svelte` (mono dots animation, reuses `--animate-blink`)
- `src/lib/ui/index.ts` — barrel.
- `src/routes/design/+page.svelte` — gallery (dev-only — guard with `if (import.meta.env.DEV)` server-side; 404 in prod).

## Reuses

- Tokens & utilities from step 00 (`@utility chip`, `tag`, `glass`, `row-base`, `row-hover-shift`, `sec-head`, `sec-title`, `sec-caption`).
- Existing pages (`/login`, `/signup`, `/account`, `/generate`, `/library`, `/pricing`) get refactored to use these components — keep diffs minimal and obvious.

## Components — contract

```ts
// Button.svelte
type ButtonVariant = 'primary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';
// 1px white border on black; hover inverts (bg white, fg black).
// `primary` = filled white. `ghost` = transparent. `danger` = filled with subtle red rule.

// Chip.svelte
// 1px var(--color-fg-15) rounded full, uppercase 10px tracked. Used for tags like "1k", "16:9", model badges.

// SectionHeader.svelte
// Wraps `sec-head` + `sec-title` + optional `sec-caption`.

// RuleRow.svelte
// Slot-based row inside a list-card; applies row-base + row-hover-shift on hover.
// Used by /pricing, /library detail-strip, /account activity.

// Field.svelte
// <label> + (<input> | <textarea> | <select>) + optional <small> hint + error slot.
// Mono input, no border-radius, 1px white-15 underline; focus → white underline.

// Modal.svelte
// Glass-style overlay; focus trap; ESC closes; portal'd to <body>; aria-modal=true.

// Toast.svelte / toast store
// Bottom-center stack, auto-dismiss 4s, mono small text. push() returns dismiss id.
```

## Steps

1. Build each component with TypeScript props + `<script lang="ts">`. Use Svelte 5 runes (`$props`, `$state`).
2. Each export gets a doc comment + a `default` slot example in the gallery.
3. Refactor existing call sites:
   - `/pricing` rows → `<RuleRow>` + `<Chip>`.
   - `/account` danger zone → `<Button variant="danger">`.
   - `/login` and `/signup` → `<Field>` + `<Button>`.
   - `/library` tile model badge → `<Chip>`.
4. Build `/design`:
   - Sections per component, each with rendered example + code-block excerpt.
   - Live "controls" panel for `Button`/`Chip` to flip variant.
5. Add `+page.server.ts` that throws `error(404)` when `!dev` to keep gallery out of prod bundles.

## Tests

Each component gets `*.spec.ts` with:
- a render test asserting key roles/text,
- one variant-specific test,
- one a11y test (role/aria assertion).

Examples:

```ts
// Button.spec.ts
test('primary renders with role=button and announces label', async () => {
  const screen = render(Button, { props: { children: 'Go', variant: 'primary' } });
  await expect.element(screen.getByRole('button', { name: 'Go' })).toBeVisible();
});

test('disabled prevents click event', async () => {
  let clicked = 0;
  const screen = render(Button, { props: { disabled: true, onclick: () => clicked++ } });
  await screen.getByRole('button').click();
  expect(clicked).toBe(0);
});

// Modal.spec.ts
test('ESC closes', async () => {
  const onClose = vi.fn();
  render(Modal, { props: { open: true, onClose } });
  await fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();
});

test('focus is trapped', async () => {
  // … assert tabbing past the last focusable element wraps to the first
});

// Field.spec.ts
test('error slot is announced via aria-describedby', async () => {
  const screen = render(Field, { props: { label: 'Email', error: 'Required' } });
  const input = screen.getByLabelText('Email');
  expect(input.getAttribute('aria-describedby')).toBeTruthy();
});
```

`e2e/design-gallery.test.ts`:

```ts
test('design gallery renders in dev', async ({ page }) => {
  await page.goto('/design');
  await expect(page.getByRole('heading', { name: /Buttons/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Modal/ })).toBeVisible();
});

test('design gallery is 404 in prod build', async ({ page }) => {
  // run against a `BUILD_TARGET=node npm run build:node && node build` instance
  const res = await page.goto('/design');
  expect(res?.status()).toBe(404);
});
```

Snapshot tests (vitest `expect.toMatchSnapshot`) on each component's HTML — break-glass lock-in for the visual shape.

## Verify

```bash
npm run check
npm run test:unit -- --run src/lib/ui
npm run test:e2e -- e2e/design-gallery.test.ts
npm run dev   # /design renders all components; existing pages still look right
```

Acceptance: every existing page uses at least one of these components (no inline buttons or ad-hoc inputs left), the gallery covers all of them, all snapshots stable, focus traps + a11y pass, prod build returns 404 for `/design`.
