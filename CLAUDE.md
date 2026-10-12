# Baby Journal — Pregnancy Tracker

## Session Onboarding
Every new session reads, in order, before any change:
1. index.html in full
2. This file, for project context, live URL, known state
3. `git log --oneline -10` for recent changes
Never assume code matches a prior session's description. Read the
actual current file.
When local testing needed, start local server (python3 -m http.server
or npx serve), give user http://localhost URL. Never tell user to open
index.html as file://. PIN bypass and other hostname checks need real
localhost origin.

## Current Known State
- Single file app: index.html (all HTML, CSS, JS in one file)
- Backend: Supabase, project ref dwvtyctgawlshbjqyeqq. Tables:
  bj_visits (medical records), bj_logs (daily logs), bj_weights
  (weight entries)
- Storage: bucket baby-journal, for file attachments
- Auth: PIN via edge function verify-pin, PIN server-side only
- Live URL: https://baby-journal-theta.vercel.app
- Deployment: Vercel, auto-deploys on push to main
- Known issue: 9 records in bj_visits still have raw base64 in file
  column, migration to Storage pending (migrate-files.js script to
  be run)
- Migration flag localStorage key: `medFilesMigrated`
  (const MED_MIGRATED_KEY, index.html:2290)

## Project
Single-file PWA. Vanilla HTML + JS. Mobile-first (max 430px).
Deployed on Vercel via GitHub. Database on Supabase.

## Config
- Start date: 27 July 2026
- PIN: server-side only (verify-pin edge function), not in source
- Supabase project ID: dwvtyctgawlshbjqyeqq
- Storage bucket: baby-journal
- Live URL: https://baby-journal-theta.vercel.app

## Design principles
- Read frontend-design, impeccable, and mobile-app-ui-design skills
  before any UI work
- Colour palette: --rose #E8748A, --sage #7BAF8E, --plum #9B6B8A,
  --cream #FFF8F5
- Fonts: DM Sans (body), Playfair Display (headings/numbers)
- Cards: white background, 12px radius, soft shadow only
- No em dashes anywhere in copy or code
- Animations: subtle, max 300ms, ease-in-out,
  respect prefers-reduced-motion
- Every interactive element needs a visible :active state
- App feel reference: Duolingo warmth + Revolut polish

## File
- Single file: index.html
- All CSS inline in <style>, all JS inline in <script>
- No build step, no npm, no frameworks

## Deployment
Push to GitHub main branch, Vercel auto-deploys in 30 seconds.
No environment variables needed, keys are in the HTML file.

## When fixing bugs
Read the relevant function first, fix minimally.
Do not refactor unrelated code.
Test at 375px viewport width.

## Approach
- Read existing files before writing. Don't re-read unless changed.
- Thorough in reasoning, concise in output.
- Skip files over 100KB unless required.
- No sycophantic openers or closing fluff.
- No emojis or em-dashes.
- Do not guess APIs, versions, flags, commit SHAs, or package names. Verify by reading code or docs before asserting.