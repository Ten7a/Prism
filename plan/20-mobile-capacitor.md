# 20 — Mobile (Capacitor) — Phase 7

> **Phase 7 — not part of the v1 web ship.** Only start this once the web build has been live for at least one full release cycle and the v1 acceptance criteria are stable.

## Goal

Wrap the SvelteKit web app in a Capacitor shell for iOS and Android, swap web Stripe for RevenueCat IAP and AdSense for AdMob, ship signed builds to TestFlight and Google Play Internal Testing.

## Touches

- `mobile/` — separate Capacitor workspace (`mobile/ios`, `mobile/android`, `capacitor.config.ts`).
- `mobile/package.json` — own deps (`@capacitor/*`, `@revenuecat/purchases-capacitor`, `@capacitor-community/admob`).
- `src/lib/platform/index.ts` — `isWeb()`, `isMobile()`, `isIOS()`, `isAndroid()` resolvers (UA + Capacitor flag).
- `src/lib/billing/index.ts` — billing facade that branches `web → Stripe`, `mobile → RevenueCat`.
- `src/lib/ads/index.ts` — ad facade that branches `web → AdSense`, `mobile → AdMob`.
- `src/routes/api/billing/revenuecat-webhook/+server.ts` — verify + credit ledger.
- `mobile/scripts/build-ios.sh`, `build-android.sh`, `live-update.sh`.
- README → add "Mobile build" section pointing here.

## Reuses

- The token ledger from step 01 (`stripeEventId` column will be reused/aliased — store the RevenueCat transaction id in the same column under `stripe_event_id` to keep one idempotency key namespace; rename to `provider_event_id` if needed).
- `PACKS` catalogue from step 07 — same product slugs, mirrored as RevenueCat entitlements.
- AdSlot component pattern from step 09.

## Constraints / gotchas

- **App store rules**: iOS requires using IAP for any purchase that unlocks digital content → Stripe is forbidden inside the iOS app. Hide `/pricing` route on `isIOS()`; use RevenueCat exclusively. Android can in theory use Stripe but Google Play also requires IAP for digital tokens — same approach.
- **Web origin**: Capacitor app loads our deployed web build via WebView. Use `server.url` to point at production OR use `webDir` for fully bundled offline-first build (preferred for store review predictability).
- **Auth**: cookies in WebView are sandboxed per-app, so Better Auth works as-is once we set `cookies: { sameSite: 'none', secure: true }` for production; verify GitHub OAuth still works inside the WebView (typically needs `OAuth` plugin to open SFSafariViewController/Custom Tabs).
- **Privacy manifests**: iOS requires a `PrivacyInfo.xcprivacy` declaring data collection categories matching our Privacy Policy from step 10.

## Steps

1. `npm init -y` in `mobile/`. Install `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`.
2. `npx cap init "Prism" "app.prism.client"` → `capacitor.config.ts`.
3. Decide on **server URL** model (point at deployed web) vs **bundled** (build then `cap copy`); document the trade-off in README.
4. Add platforms: `npx cap add ios && npx cap add android`.
5. RevenueCat:
   - Create products mirroring `PACKS` (`prism.tokens.starter`, `…pro`, `…studio`, `…bulk`).
   - In-app: `Purchases.configure({ apiKey })`, list offerings, render via `AdSlot`-style component, on `purchasePackage` success: POST to `/api/billing/revenuecat-credit` with the receipt → server verifies via RevenueCat REST → credits ledger keyed by `originalTransactionId`.
   - Webhook: RevenueCat → `/api/billing/revenuecat-webhook` (signature verified) → idempotent ledger insert.
6. AdMob:
   - `AdMob.initialize({ requestTrackingAuthorization: true })` on app boot (after consent banner from step 10 yields `ads: true`).
   - Banner ad units below `/library`, interstitial after every Nth generation (configurable; default off for MVP).
7. Build scripts:
   - `bin/mobile/build-ios.sh`: `cap sync ios && xcodebuild archive`.
   - `bin/mobile/build-android.sh`: `cap sync android && ./gradlew bundleRelease`.
8. Live updates (optional): `@capgo/capacitor-updater` to push web bundle updates without store review. Document.

## Tests

`mobile/spec/billing.spec.ts` — unit (vitest) for the billing facade:

```ts
test('isIOS routes purchases through RevenueCat', async () => {
	vi.stubGlobal('window', { Capacitor: { getPlatform: () => 'ios' } });
	const buy = createBilling();
	await buy.purchase('starter');
	expect(rcMock.purchasePackage).toHaveBeenCalledWith(
		expect.objectContaining({ identifier: 'prism.tokens.starter' })
	);
	expect(stripeMock.createSession).not.toHaveBeenCalled();
});

test('web routes purchases through Stripe', async () => {
	vi.stubGlobal('window', { Capacitor: undefined });
	const buy = createBilling();
	await buy.purchase('starter');
	expect(stripeMock.createSession).toHaveBeenCalled();
});
```

`src/routes/api/billing/revenuecat-webhook/server.spec.ts`:

```ts
test('valid signed event credits exactly once', async () => {
  // … same shape as the Stripe webhook test from step 08, but for RevenueCat
});

test('unsigned payload returns 400', async () => { … });
```

E2E: a Detox or Maestro flow on a real simulator clicking the IAP sandbox flow — out of scope for vitest; document the manual TestFlight / Internal Testing acceptance script in `mobile/QA.md`:

1. Install via TestFlight, sign up, verify email.
2. Tap **Buy 100 tokens** → Apple sandbox sheet → confirm.
3. Balance shows 100 within 10 seconds.
4. Force-quit app, relaunch — balance still 100 (server is source of truth).
5. Generate 1k image with Gemini Flash; library updates.
6. Trigger AdMob banner; verify it loads only after consent.
7. Delete account → re-login fails.

## Verify

```bash
cd mobile
npx cap sync
npm run build:ios   # emits .ipa
npm run build:android  # emits .aab
# Upload to TestFlight + Internal Testing, run manual QA above
```

Acceptance: store reviewers approve both apps; the IAP path credits the **same** ledger that the web Stripe path credits (server is single source of truth); ad units only load after consent; manual QA script passes end-to-end.
