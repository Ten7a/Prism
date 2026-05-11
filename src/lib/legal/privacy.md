# Privacy Policy

Prism ("we", "us") provides AI image generation. This document describes what
data we collect, why, where it is stored, and your rights under the EU GDPR
and UK GDPR.

> TODO before going live: replace contact details, fill in the database host
> in the sub-processor table, and have legal review the final text.

## 1. Data we collect

- **Account**: email, hashed password (or OAuth subject id), display name
  (optional), email verification status.
- **Generation**: prompts you submit, models selected, generated image bytes,
  reference images you upload, timestamps, dimensions, MIME types.
- **Billing**: Stripe customer id, transaction ids and pack/price ids — _we
  never see your card data_.
- **Consent**: a record of each time you accept or change cookie preferences
  (necessary, analytics, ads), with the policy version and timestamp.
- **Operational**: IP address (only for rate limiting; not retained after 30
  days), user-agent (only on auth events), request id.

## 2. Why we collect it (legal bases)

| Purpose                  | Legal basis (GDPR Art. 6)          |
| ------------------------ | ---------------------------------- |
| Provide the service      | Contract — Art. 6(1)(b)            |
| Bill you for tokens      | Contract — Art. 6(1)(b)            |
| Prevent abuse            | Legitimate interest — Art. 6(1)(f) |
| Show ads (optional)      | Consent — Art. 6(1)(a)             |
| Analytics (optional)     | Consent — Art. 6(1)(a)             |
| Send transactional email | Contract — Art. 6(1)(b)            |

## 3. Sub-processors

| Vendor        | Purpose             | Country |
| ------------- | ------------------- | ------- |
| OpenRouter    | AI model routing    | US      |
| Cloudflare R2 | Image storage       | EU/US   |
| Stripe        | Payments            | US/IE   |
| Resend        | Transactional email | US      |
| Database host | Database            | TBD     |

## 4. Retention

- Account data: until you delete your account.
- Generated images: until you delete them.
- Logs: 30 days.
- Backups: 14 days.

## 5. Your rights

You may exercise the following rights:

- **Access** the data we hold about you.
- **Rectify** inaccurate personal data.
- **Erase** your account and associated data.
- **Port** your data in a machine-readable format.
- **Restrict** or **object** to certain processing.
- **Withdraw consent** for analytics or advertising at any time.

Exercise these rights in your account at `/account/privacy` (export and
delete are self-service) or by emailing privacy@prism.local.

## 6. International transfers

Transfers from the EU/UK to the US rely on Standard Contractual Clauses with
each sub-processor.

## 7. Contact / DPO

privacy@prism.local — replace before going live.

## 8. Changes

We notify you of material changes by email and on the site. The current
version of this policy is shown at the top of every page.
