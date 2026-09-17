# Hosting CIVINCO safely

The hosted build runs on Render while Supabase persists its state and private source assets. Render's temporary filesystem is only a local cache; restarts restore the current data from Supabase.

The free hosting target is:

1. **GitHub** for source code. `.env`, `data/`, `.runtime/`, `dist/`, dependencies, test artifacts, and logs are ignored.
2. **Render Free** for the React site and Express server. The service may take about a minute to wake after being idle.
3. **Supabase Free** for the state snapshot and private uploaded files. The bucket is private and the Supabase secret key is used only by the Render server.
4. **Environment variables on Render:** `CIVINCO_ACCESS_PASSWORD`, `CIVINCO_SESSION_SECRET`, `SUPABASE_URL`, and `SUPABASE_SECRET_KEY`. Do not set a global `GEMINI_API_KEY`; each person supplies their own key in AI settings.

Before the first public deployment:

- Run `npm run migrate:supabase` once from the local project to upload the existing shared library and source assets.
- Confirm that the generated `civinco-private` Storage bucket is private.
- Run `npm run verify:secrets`, `npm run build`, `npm test`, and `npm run test:browser`.
- Add hosting secrets in the host dashboard, never in GitHub files.

The local `.env` can keep the owner's Gemini key after deployment because Git ignores it. The hosted site will not receive that key.
