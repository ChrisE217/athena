import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
} from '@playwright/test/reporter';
import type { AthenaReporterOptions } from '../types.js';
import { buildReport } from './collect.js';
import { writeReportFolder } from './writeReport.js';

export type { AthenaReporterOptions, AthenaReport, AthenaTest } from '../types.js';
export { buildFixPrompt } from './prompt.js';

function resolveOutputFolder(config: FullConfig, configured: string): string {
  if (isAbsolute(configured)) return configured;
  const base = config.configFile ? dirname(config.configFile) : process.cwd();
  return join(base, configured);
}

class AthenaReporter implements Reporter {
  private readonly options: Required<AthenaReporterOptions>;
  private config!: FullConfig;
  private rootSuite!: Suite;
  private startTime = new Date();
  private outputFolder = 'athena-report';

  constructor(options: AthenaReporterOptions = {}) {
    this.options = {
      outputFolder: options.outputFolder ?? 'athena-report',
      open: options.open ?? 'on-failure',
      title: options.title ?? 'Athena',
    };
  }

  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.rootSuite = suite;
    this.startTime = new Date();
    this.outputFolder = resolveOutputFolder(config, this.options.outputFolder);

    rmSync(this.outputFolder, { recursive: true, force: true });
    mkdirSync(join(this.outputFolder, 'data'), { recursive: true });
  }

  async onEnd(result: FullResult): Promise<void> {
    const duration = Date.now() - this.startTime.getTime();
    const report = buildReport({
      config: this.config,
      rootSuite: this.rootSuite,
      status: result.status,
      startTime: this.startTime,
      duration,
      destRoot: this.outputFolder,
      title: this.options.title,
    });

    writeReportFolder(this.outputFolder, report);

    // eslint-disable-next-line no-console
    console.log(`\nAthena report: ${this.outputFolder}`);
    // eslint-disable-next-line no-console
    console.log(`View with: npx athena show ${this.options.outputFolder}`);

    const shouldOpen =
      this.options.open === 'always' ||
      (this.options.open === 'on-failure' && result.status !== 'passed');

    if (shouldOpen) {
      this.openReport();
    }
  }

  private openReport(): void {
    const cli = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'cli.js');
    try {
      spawn(process.execPath, [cli, 'show', this.outputFolder], {
        stdio: 'ignore',
        detached: true,
      }).unref();
    } catch {
      // ignore
    }
  }
}

export default AthenaReporter;
