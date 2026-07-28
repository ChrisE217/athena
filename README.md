# Athena

A fast Playwright reporter with a custom report UI — steps, failures, screenshots, traces, pass heatmap, duration bars, and AI fix prompts.

## Install

```bash
npm i -D athena-playwright-reporter
```

Requires Node 18+ and `@playwright/test` ≥ 1.40 (peer dependency).

## Quick start

Drop Athena into `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [['athena-playwright-reporter']],
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
```

Run your tests:

```bash
npx playwright test
```

Open the report (written to `athena-report/` by default):

```bash
npx athena show
```

That’s it. Screenshots and traces only show up if Playwright is configured to capture them (`use.screenshot` / `use.trace` above).

---

## Reporter options

Pass options as the second element of the reporter tuple:

```ts
reporter: [
  ['list'], // optional: keep Playwright’s terminal reporter
  ['athena-playwright-reporter', {
    outputFolder: 'athena-report',
    open: 'on-failure',
    title: 'Athena',
  }],
],
```

| Option | Type | Default | Description |
|---|---|---|---|
| `outputFolder` | `string` | `'athena-report'` | Directory for the HTML report and attachments. Relative paths resolve from the Playwright config file’s directory (or `cwd` if no config file). Absolute paths are used as-is. **Wiped on each run.** |
| `open` | `'always' \| 'never' \| 'on-failure'` | `'on-failure'` | Whether to auto-open the report in a browser when the run finishes. `'on-failure'` opens when the run status is not `passed`. |
| `title` | `string` | `'Athena'` | Title shown in the report UI / document. |

TypeScript types are exported:

```ts
import type { AthenaReporterOptions } from 'athena-playwright-reporter';
```

### Recommended Playwright settings

Athena surfaces whatever Playwright attaches. For the best report:

```ts
use: {
  screenshot: 'only-on-failure', // or 'on'
  trace: 'retain-on-failure',    // or 'on'
  // video: 'retain-on-failure', // optional
},
```

---

## CLI

Installed as the `athena` binary.

### `athena show [reportDir]`

Serve a report over HTTP (needed for **Open Trace** from the UI).

```bash
npx athena show                  # ./athena-report
npx athena show athena-report
npx athena show ./path/to/report --port 9324
npx athena show athena-report --no-open
```

| Flag | Default | Description |
|---|---|---|
| `[reportDir]` | `athena-report` | Folder containing `index.html` + `report.json` |
| `--port <n>` | `9324` | Port for the local static server (`127.0.0.1`) |
| `--no-open` | off | Do not open a browser tab |

Shorthand: `npx athena <reportDir>` works if that folder already has an `index.html`.

### `athena trace <trace.zip>`

Launch Playwright’s trace viewer for a specific trace file:

```bash
npx athena trace athena-report/data/tests/<id>/attempt-0/<trace>.zip
```

Equivalent to `npx playwright show-trace <file>`.

---

## Report UI settings

In-browser settings (gear icon) persist in `localStorage` under `athena.settings`:

| Setting | Default | Description |
|---|---|---|
| **Raw file names** | off | Group / label tests by file path instead of suite titles |

---

## What you get

- Pass / fail / flaky / skipped / timed out overview with pass-rate meter
- Suite tree with durations
- Outcome heatmap + slowest-tests bars
- Per-test steps (failed step highlighted)
- Error details, source snippet, failure screenshot
- **Open Trace** / snapshot actions (via `athena show`)
- **Copy fix prompt** plus Cursor / ChatGPT / Claude deep links

### AI fix prompt

On failures, Athena builds a structured prompt (role, constraints, test info, call log, source, artifacts) for pasting into an LLM:

- **Copy fix prompt** — full markdown to clipboard
- **Cursor / ChatGPT / Claude** — open with a URL-safe prefix; full prompt is copied when truncated

`window.__ATHENA_PROMPT_BUILDER__` is exposed for future API integrations.

---

## CI

In CI, set `open: 'never'` so nothing tries to launch a browser:

```ts
reporter: [
  ['athena-playwright-reporter', {
    outputFolder: 'athena-report',
    open: 'never',
  }],
],
```

Upload `athena-report/` as a build artifact, then open locally:

```bash
npx athena show ./athena-report
```

---

## Develop

```bash
npm install
npm run build           # UI + reporter → dist/
npm run dev:ui          # UI against ui/public/report.json
```

Smoke example:

```bash
npm run build
cd examples/smoke && npm install && npx playwright install chromium && npm test
npx athena show athena-report
```

### Publish (maintainers)

```bash
npm login
npm version patch   # or minor / major
npm publish
```

`prepublishOnly` / `prepack` run `npm run build` automatically. Dry-run with `npm pack --dry-run`.

## License

MIT
