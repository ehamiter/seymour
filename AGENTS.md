# Repository Guidelines

## Project Structure & Module Organization
- `src/server.ts` is the Bun entrypoint; it wires routing, auth, and the feed fetcher.
- `src/feed-fetcher.ts` schedules and runs fetch jobs; `src/feed-parser.ts` handles RSS/Atom parsing.
- `src/db.ts` owns the SQLite schema and queries; default DB lives at `data/reader.sqlite` (override with `DB_PATH`).
- `src/html.ts` renders the UI; `src/opml.ts` imports feeds from OPML uploads.
- Runtime assets: `favicon.ico`, `seymour.png`; `data/` is generated at runtime and should stay out of commits.

## Build, Test, and Development Commands
- `bun install` installs dependencies (Bun runtime required).
- `bun dev` runs the server in watch mode for local work; `bun start` runs the same entrypoint once.
- Useful env vars: `PORT` (default 3000), `PAGE_SIZE`, `APP_PASSWORD` (Basic Auth), `FETCH_INTERVAL_MS`, `FETCH_TIMEOUT_MS`, `HTTP_USER_AGENT`, `DB_PATH`.
- Example: `APP_PASSWORD=secret PORT=4000 bun dev`.

## Coding Style & Naming Conventions
- TypeScript + ES modules with 2-space indentation, double quotes, and trailing commas to match existing files.
- Keep database access in `db.ts` and parsing in `feed-parser.ts`; keep route handlers thin and side-effect free beyond I/O.
- Use explicit return types on exported functions and small helpers for parsing, scheduling, and rendering logic.

## Testing Guidelines
- No automated tests yet; smoke-test via `bun dev`, load `/`, and add a feed to verify fetching/rendering.
- When touching parsing or fetch flows, test with the Hacker News front page feed `https://hnrss.org/frontpage` (store temporary files under `data/`) and confirm entries appear on `/`.
- If adding tests, co-locate them (e.g., `src/feed-parser.test.ts`) and add a `bun test` script before merging.

## Commit & Pull Request Guidelines
- Do not do any git operations. The user will handle this.

## Post-operation Guidelines
- After any significant amount of work has been done, update `README.md` to keep the end-users informed of the current state of the app.

## Security & Configuration Tips
- Set `APP_PASSWORD` in any shared deployment; avoid committing real DB files or secrets.
- Tune fetch cadence via env vars instead of code edits; be mindful of remote servers’ rate limits.
- Keep error logging concise; sensitive details should stay out of responses and commits.
