# 09 — Ads (AdSense)

## Goal

Show non-intrusive Google AdSense slots on the web build, but only after explicit user consent — and never serve the ad script until consent is granted.

## Touches

- `src/lib/components/AdSlot.svelte` — consent-gated, lazy-loaded ad component.
- `src/lib/stores/consent.ts` — readable store derived from cookie + `consentRecord`.
- `src/lib/server/ads/adsense.ts` — server-side helpers (build the `<ins>` markup with the right `data-ad-client` / `data-ad-slot`).
- `src/routes/library/+page.svelte` — slot above the grid (`slot="library-top"`).
- `src/routes/+page.svelte` — slot in landing footer (`slot="landing-footer"`).
- `.env.example` — `PUBLIC_ADSENSE_CLIENT_ID` (`ca-pub-…`), per-slot env vars (`PUBLIC_ADSENSE_SLOT_LIBRARY_TOP`, etc.).

## Reuses

- `consentRecord` table from step 01.
- Consent banner store/component built in step 10 (this step assumes the store exists; if step 10 lands later, stub it as `{ ads: false }`).

## Behaviour

- Without `consent.ads === true`: render nothing (no `<ins>`, no script tag, no network call).
- On consent: dynamically inject the AdSense script tag exactly once per page load, then render `<ins>` and call `(adsbygoogle = window.adsbygoogle || []).push({})`.
- Respect Do-Not-Track header: if `DNT=1`, ignore the consent flag and never load.
- Add `data-nscript="lazyOnload"`-style `loading="lazy"` semantics where possible.

## Steps

1. `consent.ts`: subscribes to a small SSR-friendly store. Hydrated on the client from a cookie set by step 10's banner. Exports `consentStore` (writable) and `loadConsent(event)` (server-side).
2. `AdSlot.svelte`:

   ```svelte
   <script lang="ts">
     import { consentStore } from '$lib/stores/consent';
     import { onMount } from 'svelte';
     export let slot: 'library-top' | 'landing-footer';
     export let format: 'auto' | 'fluid' = 'auto';
     let mounted = false;
     onMount(() => { mounted = true; });
     $: enabled = mounted && $consentStore.ads && !navigator.doNotTrack;
     $: if (enabled) loadAdSenseOnce();
   </script>
   {#if enabled}
     <ins class="adsbygoogle" style="display:block"
          data-ad-client={env.PUBLIC_ADSENSE_CLIENT_ID}
          data-ad-slot={slotIdFor(slot)}
          data-ad-format={format}
          data-full-width-responsive="true"></ins>
   {/if}
   ```

3. `loadAdSenseOnce()` — guards on `window.__adsenseLoaded`, injects the script with `async` + `crossorigin="anonymous"`, then `(adsbygoogle = window.adsbygoogle || []).push({})`.
4. Place slots: top of `/library`, bottom of `/` landing page. **Never** on `/generate` (would be too noisy during a purchase funnel) or `/account`.

## Tests

`src/lib/components/AdSlot.spec.ts` (vitest-browser-svelte):

```ts
test('renders nothing without consent', async () => {
  consentStore.set({ necessary: true, analytics: false, ads: false });
  const screen = render(AdSlot, { props: { slot: 'library-top' } });
  expect(screen.container.querySelector('ins.adsbygoogle')).toBeNull();
  expect(document.querySelector('script[src*="pagead2"]')).toBeNull();
});

test('renders <ins> + injects script once consent granted', async () => {
  consentStore.set({ necessary: true, analytics: true, ads: true });
  render(AdSlot, { props: { slot: 'library-top' } });
  await vi.waitFor(() => {
    expect(document.querySelectorAll('script[src*="pagead2"]')).toHaveLength(1);
    expect(document.querySelector('ins.adsbygoogle')).toBeTruthy();
  });
});

test('respects Do-Not-Track even with consent', async () => {
  Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
  consentStore.set({ ads: true });
  render(AdSlot, { props: { slot: 'library-top' } });
  expect(document.querySelector('ins.adsbygoogle')).toBeNull();
});
```

`e2e/ads-consent.test.ts`:

```ts
test('AdSense script absent until banner accepted', async ({ page }) => {
  await page.goto('/library', { waitUntil: 'networkidle' });
  await expect(page.locator('script[src*="pagead2"]')).toHaveCount(0);
  await page.getByRole('button', { name: /accept all/i }).click();
  await expect(page.locator('script[src*="pagead2"]')).toHaveCount(1);
});
```

Edge case: `consent.ads` flipped from `true` back to `false` (user revokes via /account/privacy from step 10) — existing `<ins>` should be removed and the script disabled until next reload (test that the slot disappears).

## Verify

```bash
npm run check
npm run test:unit -- --run src/lib/components/AdSlot.spec.ts
npm run test:e2e -- e2e/ads-consent.test.ts
npm run dev   # /library shows nothing until banner accepted
```

Acceptance: with consent off, **zero** AdSense network requests are made anywhere in the app; with consent on, the `<ins>` slot is rendered exactly once per page and the script is injected at most once.
