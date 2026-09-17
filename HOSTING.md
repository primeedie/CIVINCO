# Hosting CIVINCO safely

The current build is ready for local use and GitHub, but its writable data layer is intentionally local: SQLite and uploaded files live under `data/`. Do **not** deploy it directly to Vercel or a free Render web service yet. Their runtime filesystems are temporary, so uploads and study progress would eventually disappear.

The free hosting target is:

1. **GitHub** for source code. `.env`, `data/`, `.runtime/`, `dist/`, dependencies, test artifacts, and logs are ignored.
2. **Vercel Hobby** for the React site and stateless API routes.
3. **Supabase Free** for persistent records and private uploaded files. Use a private Storage bucket and server-generated signed URLs; never expose a Supabase service-role key to the browser.
4. **Environment variables on Vercel:** `CIVINCO_ACCESS_PASSWORD`, `CIVINCO_SESSION_SECRET`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Do not set a global `GEMINI_API_KEY`; each person supplies their own key in AI settings.

Before the first public deployment:

- Replace the SQLite store with the Supabase adapter and move source-file reads/writes to private Supabase Storage.
- Change extraction into resumable page jobs that finish within the host's request duration.
- Import the shared SPEX A library into Supabase without owner IDs so it remains public and read-only.
- Run `npm run verify:secrets`, `npm run build`, `npm test`, and `npm run test:browser`.
- Add hosting secrets in the host dashboard, never in GitHub files.

The local `.env` can keep the owner's Gemini key after deployment because Git ignores it. The hosted site will not receive that key.
