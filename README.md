# CIVINCO for Milch

A personal civil engineering integration / pre-board review companion. Built with React, TypeScript, Express, SQLite, KaTeX, and Google Gemini.

## Open the app

On this Windows machine, double-click **START-CIVINCO.cmd**, then open **http://localhost:4173**. A portable Node.js runtime has been installed inside `.runtime` for this workspace. Keep the terminal running while you study.

With Node.js 24 or newer installed:

```sh
npm install
npm run build
npm start
```

For development, use `npm run dev`. Both modes serve the frontend and API at the same local address. The server binds to `127.0.0.1`; this is a single-user local app, not a publicly deployed multi-user service.

## Your course structure

| Examination | Subject |
| --- | --- |
| SPEX A | PSAD |
| SPEX B | MSTE |
| SPEX C | HGE |

Every source and study entry has an examination and a numbered Set. Filters apply across the requested navigation order: **Home → Concepts & Formulas → Practice → Flashcards → Progress**. Change a file’s category from its details. Existing questions and historical attempts retain the category they were originally studied under.

## Study workflow

1. **Home:** upload multiple files and choose automatic categorization or a manual SPEX and Set. Automatic categorization reads each file’s first page during its first extraction request, so it does not add an API call. PDF, PNG, JPG, UTF-8 TXT, and MD are supported; up to 20 files per upload, each up to 100 MB.
2. **Extract:** open a file’s details and start extraction. Gemini processes one page per request. Completed pages are saved and skipped when you resume.
3. **Check symbols and coverage:** free mode sends each page in one Gemini request and asks the model to perform an internal completeness sweep before returning every displayed and inline equation, definition, constraint, table equation, and worked-example step. KaTeX validates mathematical syntax locally. Check each formula against its linked original, edit LaTeX and variable meanings, resolve uncertainty, and approve it. Then mark the source page reviewed. Add a missing equation manually using **Add a formula**. The page inventory makes incomplete and failed pages visible, including pages with zero equations.
4. **Practice:** choose **Generate new questions**, a SPEX and Set, count, and difficulty. AI questions use up to 30 selected source entries per set; new generations rotate the selection. Formula sources must be approved and have valid notation. Gemini returns validated drawing primitives for problems that need a force, structure, survey, hydraulic, soil, or geometry diagram. Generated questions and diagrams receive an independent solution check before saving. Enter a numeric answer in the displayed unit; answers are checked on the server and initial state never includes answer keys or solutions.
5. **Flashcards:** study concepts, equations, or a mixed deck. Equations and variable definitions render with KaTeX. Unapproved/uncertain formulas are excluded. Rate your recall to schedule reviews: Again = 10 minutes, Hard = 1 day, Good = an expanding interval, Easy = a longer interval. Use due-only filtering or browse the whole deck.
6. **Progress:** view first-attempt accuracy, recent activity, flashcard reviews, and topic strengths/weaknesses. Repeated attempts do not inflate accuracy. Viewing the solution before answering is tracked separately and excluded from accuracy. Topic labels start after three scored attempts.

**AI cannot guarantee that every equation is found or every symbol is correct.** The app processes all pages, preserves uncertain candidates, surfaces failures, and provides manual source review instead of equating successful AI processing with verified completeness. This is especially important for faint scans, dense equations, ambiguous glyphs, diagrams, and definitions on other pages. Generated numerical answers also warrant source checking when something seems inconsistent.

## Connect AI

Open **AI settings**, enter a Gemini API key and compatible model, then choose **Save & test connection**. Gemini powers first-page classification, equation/concept extraction, and generated practice with solutions and diagrams. A key entered in the UI is kept only in server memory until restart; it is not placed in browser storage, responses, or the client bundle.

For persistent configuration, copy `.env.example` to `.env` and set:

```dotenv
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.6-flash
PORT=4173
```

Gemini 3.6 Flash supports visual/PDF input and structured outputs. Free mode sends each source page once. Question generation still uses a separate solution and diagram audit, so starter practice is the no-API alternative when conserving quota. Google API quotas and data policies apply. The app does not send uploaded files until you start extraction.

Official integration references: [Gemini document processing](https://ai.google.dev/gemini-api/docs/document-processing) and [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output).

**Try starter references** on Home adds clearly labeled illustrative materials for all three SPEX. These are not your uploaded modules. Starter questions are locally calculated randomized examples and work without an API key. Starter material is assigned to Set 1 and can be removed from its source details. Your previously mentioned PSAD Set 1 module was not present in this workspace and has not been imported.

## Data and recovery

- `data/civinco.sqlite` stores categories, extraction inventory, formulas, concepts, questions, attempts, and recall schedules.
- `data/uploads/` stores original files under generated names.
- Back up the entire `data` folder **after stopping the app**. Keep your API key separately. `.env`, `data`, runtime files, and dependencies are excluded from Git.
- Pause takes effect after an in-flight page finishes. Resume processes unfinished/failed pages and keeps successful results. After a restart, interrupted jobs are marked paused so you can resume explicitly.
- Removing a source permanently removes its linked entries, questions, and associated progress, after an in-app confirmation.
- Light/dark mode follows your system on first use and persists your chosen theme in the browser.

## Verification

```sh
npm run build
npm test
npm run test:browser
```

Tests cover grading and unit expectations, first-attempt accounting, source coverage, uploads, category changes, persistence, deletion, spaced review, LaTeX symbol preservation, incomplete AI responses, extraction reconciliation, invented source rejection, and failed solution audits. Browser tests cover the complete starter study flow, formula editing, uploads, responsive layouts, and themes. Browser tests use installed Chrome by default; set `CHROME_PATH` if needed. Screenshots are saved to `test-results/screenshots/`.

Gemini request orchestration and structured diagrams are tested with controlled responses. A connection check validates model access; real-document equation recall and symbol accuracy still require source-by-source evaluation.
