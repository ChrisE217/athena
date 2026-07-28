# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-07-28

### Added

- Sharded run support: each `--shard` writes to `{outputFolder}/shards/{n}-of-{total}/`
- Automatic merge into `{outputFolder}` once every shard report is present on disk
- CLI: `athena merge` for CI (artifact download) and partial merges (`--allow-partial`)
- Reporter option: `autoMerge` (default `true`)
- Tests: `npm test` (merge/shard unit tests) and `npm run test:shards` (2-shard smoke)

## [0.1.0] - 2026-07-28

### Added

- Playwright reporter that writes a self-contained HTML report
- Suite tree, outcome heatmap, slowest-tests bars, per-test steps
- Failure screenshots, error snippets, and Open Trace actions
- AI fix prompt builder with Copy / Cursor / ChatGPT / Claude actions
- CLI: `athena show` (static server) and `athena trace`
- Reporter options: `outputFolder`, `open`, `title`
