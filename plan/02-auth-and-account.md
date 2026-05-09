# 02 — Auth & account

## Goal

Wire email verification + password reset through Resend, expose a minimal `/account` page (email, balance, recent activity, danger zone), and implement a working delete-account flow that cascades through every Prism table.

## Touches

- `src/lib/server/auth.ts` — add `emailVerification`, `forgetPassword` config; pass Resend transport.
- `src/lib/server/email/resend.ts` — thin Resend client wrapper with template helpers.
- `src/lib/server/email/templates/` — `verify-email.ts`, `reset-password.ts`, `receipt.ts` (used later by 08).
- `src/routes/login/+page.svelte` + `+page.server.ts` — sign-in form.
- `src/routes/signup/+page.svelte` + `+page.server.ts` — sign-up form.
- `src/routes/verify/+page.svelte` — landing for the verification link.
- `src/routes/reset/+page.svelte` + `[token]/+page.svelte` — password reset.
- `src/routes/account/+page.server.ts` + `+page.svelte` — profile.
- `src/routes/account/delete/+page.server.ts` — POST action that wipes the user.
- `src/hooks.server.ts` — attach `event.locals.session` and `event.locals.user`.
- `.env.example` — add `RESEND_API_KEY`, `EMAIL_FROM`, `SMTP_URL` (fallback for self-hosters).

## Reuses

- Existing [`src/lib/server/auth.ts`](../src/lib/server/auth.ts) (Better Auth minimal + Drizzle adapter).
- Better Auth's built-in `requireEmailVerification` flag.
- `getBalance(userId)` from step 01.
- Cascade `onDelete: 'cascade'` already declared on every Prism table from step 01 — so user delete naturally wipes ledger, jobs, images, consent.

## Steps

1. Add `resend` to dependencies. Build `email/resend.ts`:

   ```ts
   const transport = env.RESEND_API_KEY
     ? new Resend(env.RESEND_API_KEY)
     : new SmtpTransport(env.SMTP_URL); // fallback
   export async function sendMail({ to, subject, html, text }) { … }
   ```

2. Templates are tiny mono-style HTML strings (no framework) — black bg, white text, single `<a>` button. Keep under 5KB each.
3. Update `auth.ts`:

   ```ts
   emailAndPassword: {
     enabled: true,
     requireEmailVerification: true,
     sendResetPassword: ({ user, url }) => sendMail(resetTemplate(user.email, url))
   },
   emailVerification: {
     sendOnSignUp: true,
     sendVerificationEmail: ({ user, url }) => sendMail(verifyTemplate(user.email, url))
   },
   ```

4. `hooks.server.ts` — call `auth.api.getSession({ headers })` and stash on `event.locals`. Type via `src/app.d.ts`.
5. Build `/login`, `/signup` SvelteKit form actions using `auth.api.signInEmail` / `signUpEmail`. Use the design-system `Field` component (added formally in step 11; for now inline a styled `<input>`).
6. `/account` page: email, verified state, current balance (`getBalance`), last 10 generations (link to `/library/[id]`), Stripe receipt history link, "Delete account" danger zone.
7. `/account/delete` action: confirms password, then `db.delete(user).where(eq(user.id, id))`. Cascades remove everything.
8. After delete, schedule R2 object cleanup: enqueue a `deleted_user_keys` job row (or simpler: list `image.r2_key` *before* the cascade and pass to a `bulkDelete` call against R2 in the same handler).

## Tests

`src/lib/server/email/resend.spec.ts` — uses `msw` to mock `https://api.resend.com/emails`:

```ts
test('verify-email template includes the verify URL', async () => {
  await sendMail(verifyTemplate('a@b.test', 'https://x/y?t=abc'));
  expect(lastResendBody().html).toContain('https://x/y?t=abc');
});
test('falls back to SMTP when RESEND_API_KEY is unset', async () => { … });
```

E2E `e2e/auth.test.ts`:

```ts
test('signup → verify → login flow', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Email').fill('e2e@prism.test');
  await page.getByLabel('Password').fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Sign up' }).click();
  // intercept Resend mock and grab the verify URL from outbox
  const url = await waitForVerifyEmail('e2e@prism.test');
  await page.goto(url);
  await expect(page.getByText(/email verified/i)).toBeVisible();
  await page.goto('/login');
  // … sign in, expect /account
});

test('account delete wipes ledger and images', async ({ page, request }) => {
  // seed a verified user with one generation; call delete; assert /api/admin/peek shows zero rows for that user
});
```

Edge case: `/login` rejects unverified accounts (Better Auth default), shows resend-verification button.

## Verify

```bash
npm run check
npm run test:unit -- --run
npm run test:e2e
npm run dev   # signup, verify, login, view /account, delete account
```

Acceptance: a brand-new email can sign up, receive a verification mail (visible in Resend dashboard or local SMTP catcher), log in, see `/account` with `0` balance until step 07 grants the daily allowance, and successfully self-delete.
