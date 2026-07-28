# Athena

A fast Playwright reporter with a custom report UI — steps, failures, screenshots, traces, pass heatmap, duration bars, and AI fix prompts.

## Install

```bash
npm i -D athena-playwright
```

Requires Node 18+ and `@playwright/test` ≥ 1.40 (peer dependency).

## Quick start

Drop Athena into `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [['athena-playwright']],
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
  ['athena-playwright', {
    outputFolder: 'athena-report',
    open: 'on-failure',
    title: 'Athena',
  }],
],
```

| Option | Type | Default | Description |
|---|---|---|---|
| `outputFolder` | `string` | `'athena-report'` | Directory for the HTML report and attachments. Relative paths resolve from the Playwright config file’s directory (or `cwd` if no config file). Absolute paths are used as-is. **Wiped on each unsharded run.** |
| `open` | `'always' \| 'never' \| 'on-failure'` | `'on-failure'` | Whether to auto-open the report in a browser when the run finishes. `'on-failure'` opens when the run status is not `passed`. |
| `title` | `string` | `'Athena'` | Title shown in the report UI / document. |
| `autoMerge` | `boolean` | `true` | When using Playwright `--shard`, write each shard under `outputFolder/shards/{n}-of-{total}/` and merge into `outputFolder` automatically once all shard reports exist on disk. |

TypeScript types are exported:

```ts
import type { AthenaReporterOptions } from 'athena-playwright';
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

### `athena merge [reportDir|dirs...]`

Merge sharded (or separately collected) Athena reports into one.

```bash
# After all shards wrote to athena-report/shards/{n}-of-{total}/
npx athena merge athena-report

# Merge explicit report folders (e.g. downloaded CI artifacts)
npx athena merge ./shard-1 ./shard-2 ./shard-3 -o merged-athena-report

# Directory whose children each contain report.json
npx athena merge ./downloaded-artifacts -o merged-athena-report

npx athena merge athena-report --allow-partial   # missing shards ok
npx athena merge athena-report --title "Nightly"
```

| Flag | Default | Description |
|---|---|---|
| `[reportDir]` | `athena-report` | Folder containing `shards/` **or** child report dirs |
| `-o, --output <dir>` | in-place / `merged-athena-report` | Where to write the merged report |
| `--allow-partial` | off | Merge even if some `{n}-of-{total}` shards are missing |
| `--title <name>` | first report’s title | Title for the merged report |

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
  ['athena-playwright', {
    outputFolder: 'athena-report',
    open: 'never',
  }],
],
```

Upload `athena-report/` as a build artifact, then open locally:

```bash
npx athena show ./athena-report
```

### Sharded CI

Athena is shard-aware. Each job writes only its shard folder (other shards on disk are left alone):

```bash
npx playwright test --shard=1/4   # → athena-report/shards/1-of-4/
npx playwright test --shard=2/4   # → athena-report/shards/2-of-4/
# ...
```

**Same machine / shared disk:** when the last shard finishes, Athena auto-merges into `athena-report/`.

**Separate CI jobs:** upload each job’s `athena-report/shards/` (or the whole `athena-report/`), download them into one tree, then merge:

```bash
# after collecting shards into ./athena-report/shards/{1-of-4,2-of-4,...}
npx athena merge ./athena-report

# or merge downloaded per-job report dirs
npx athena merge ./artifacts/shard-* -o merged-athena-report
```

GitHub Actions sketch:

```yaml
strategy:
  matrix:
    shard: [1, 2, 3, 4]
steps:
  - run: npx playwright test --shard=${{ matrix.shard }}/4
  - uses: actions/upload-artifact@v4
    with:
      name: athena-shard-${{ matrix.shard }}
      path: athena-report/shards/

# merge job:
# - download all athena-shard-* into athena-report/shards/
# - npx athena merge athena-report
# - upload athena-report/ (merged index.html + report.json + data/)
```

---

## Develop

```bash
npm install
npm run build           # UI + reporter → dist/
npm run dev:ui          # UI against ui/public/report.json
npm test                # build + merge/shard unit tests
npm run test:shards     # e2e: smoke suite as 2 shards + auto-merge assert
```

Smoke example:

```bash
npm run build
cd examples/smoke && npm install && npx playwright install chromium && npm test
npx athena show athena-report

# sharded (also: npm run test:shards from repo root)
npx playwright test --shard=1/2
npx playwright test --shard=2/2
npx athena show athena-report
```

### Publish (maintainers)

Publishing is handled by GitHub Actions on release (`.github/workflows/publish.yml`) with npm provenance.

One-time setup on [npmjs.com](https://www.npmjs.com) → package (or account) → **Trusted Publisher** → GitHub Actions:

- Repository: `ChrisE217/athena`
- Workflow: `publish.yml`

Then:

```bash
npm version patch   # or minor / major
git push --follow-tags
gh release create v$(node -p "require('./package.json').version") --generate-notes
```

Manual publish still works (`npm login && npm publish`). `prepublishOnly` / `prepack` run `npm run build`. Dry-run with `npm pack --dry-run`.

## License

MIT
