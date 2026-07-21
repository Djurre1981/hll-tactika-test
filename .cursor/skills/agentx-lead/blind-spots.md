# Blind spots checklist (lead foresight)

Use the sections that match the feature. Present only relevant items to the user as **recommended defaults** (include / skip). Keep language simple.

## Login / accounts / auth

- [ ] Max failed attempts, then temporary lockout or wait time
- [ ] “Forgot password” / reset flow
- [ ] Strong password rules (or passkeys) explained simply
- [ ] Secure session cookies (not easy-to-steal tokens in localStorage) when building a website
- [ ] Logout everywhere / revoke sessions (if multi-device matters)
- [ ] Email verification (if spam or fake accounts matter)
- [ ] Admin vs normal user roles (if anyone gets extra powers)
- [ ] Prefer a known auth product over home-grown crypto when the user is solo

## Forms / public input

- [ ] Validate on server, not only in the browser
- [ ] Basic spam / bot protection on public forms
- [ ] Clear error messages without leaking secrets
- [ ] File upload size/type limits (if uploads exist)

## Storing data

- [ ] Real database vs file/JSON/spreadsheet — say when each breaks (multi-user, backups, size)
- [ ] Backups / export path
- [ ] What is private vs public
- [ ] Don’t store passwords in plain text (ever)
- [ ] Soft delete vs hard delete if user content matters

## Payments / money

- [ ] Use a payment provider (Stripe etc.) — don’t store card numbers yourself
- [ ] Webhooks + idempotency (“don’t charge twice”)
- [ ] Test mode vs live mode clarity
- [ ] Receipts / order history

## Emails / notifications

- [ ] Transactional email provider vs “hope the server can send mail”
- [ ] Unsubscribe for marketing mail
- [ ] Don’t email secrets in plain links forever (expiring reset links)

## Websites / apps (general)

- [ ] Mobile layout early if users are on phones
- [ ] Accessibility basics (labels, contrast, keyboard)
- [ ] Environment secrets (API keys) not committed to git
- [ ] Basic error logging so breakages are visible
- [ ] HTTPS in production

## Multi-user / teams

- [ ] Who can see whose data
- [ ] Invite flow and removing access
- [ ] Audit trail for sensitive admin actions (optional but valuable)

## Performance / growth (only if relevant)

- [ ] Image compression / CDN for media-heavy sites
- [ ] Pagination instead of loading “all rows”
- [ ] Caching only when there’s a real pain

## When recommending “skip for now”

Say what you’re skipping and the trigger to add it later  
(“Skip email verification until you open signups to the public”).
