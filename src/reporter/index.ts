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
import {
  allShardsPresent,
  shardReportDir,
  tryAutoMergeShards,
  writeShardMeta,
  type ShardInfo,
} from './merge.js';
import { writeReportFolder } from './writeReport.js';

export type { AthenaReporterOptions, AthenaReport, AthenaTest } from '../types.js';
export { buildFixPrompt } from './prompt.js';
export {
  mergeAthenaReports,
  mergeReportDirectories,
  mergeShardsIntoOutput,
  listShardReportDirs,
  allShardsPresent,
  tryAutoMergeShards,
} from './merge.js';

function resolveOutputFolder(config: FullConfig, configured: string): string {
  if (isAbsolute(configured)) return configured;
  const base = config.configFile ? dirname(config.configFile) : process.cwd();
  return join(base, configured);
}

function readShard(config: FullConfig): ShardInfo | null {
  const shard = config.shard;
  if (!shard || !shard.total || !shard.current) return null;
  return { current: shard.current, total: shard.total };
}

class AthenaReporter implements Reporter {
  private readonly options: Required<AthenaReporterOptions>;
  private config!: FullConfig;
  private rootSuite!: Suite;
  private startTime = new Date();
  private outputFolder = 'athena-report';
  private writeFolder = 'athena-report';
  private shard: ShardInfo | null = null;

  constructor(options: AthenaReporterOptions = {}) {
    this.options = {
      outputFolder: options.outputFolder ?? 'athena-report',
      open: options.open ?? 'on-failure',
      title: options.title ?? 'Athena',
      autoMerge: options.autoMerge ?? true,
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
    this.shard = readShard(config);

    if (this.shard) {
      this.writeFolder = shardReportDir(this.outputFolder, this.shard);
      mkdirSync(join(this.outputFolder, 'shards'), { recursive: true });
      writeShardMeta(this.outputFolder, this.shard, this.options.title);
    } else {
      this.writeFolder = this.outputFolder;
    }

    rmSync(this.writeFolder, { recursive: true, force: true });
    mkdirSync(join(this.writeFolder, 'data'), { recursive: true });
  }

  async onEnd(result: FullResult): Promise<void> {
    const duration = Date.now() - this.startTime.getTime();
    const report = buildReport({
      config: this.config,
      rootSuite: this.rootSuite,
      status: result.status,
      startTime: this.startTime,
      duration,
      destRoot: this.writeFolder,
      title: this.options.title,
    });

    writeReportFolder(this.writeFolder, report);

    let merged = false;
    let openStatus: FullResult['status'] = result.status;

    if (this.shard) {
      // eslint-disable-next-line no-console
      console.log(
        `\nAthena shard report (${this.shard.current}/${this.shard.total}): ${this.writeFolder}`,
      );

      if (this.options.autoMerge) {
        const mergedReport = tryAutoMergeShards(this.outputFolder, {
          title: this.options.title,
          total: this.shard.total,
        });
        if (mergedReport) {
          merged = true;
          openStatus = mergedReport.status;
          // eslint-disable-next-line no-console
          console.log(`Athena merged report: ${this.outputFolder}`);
          // eslint-disable-next-line no-console
          console.log(`View with: npx athena show ${this.options.outputFolder}`);
        } else if (!allShardsPresent(this.outputFolder, this.shard.total)) {
          // eslint-disable-next-line no-console
          console.log(
            `Waiting for remaining shards under ${join(this.outputFolder, 'shards')}`,
          );
          // eslint-disable-next-line no-console
          console.log(
            `Merge later with: npx athena merge ${this.options.outputFolder}`,
          );
        }
      } else {
        // eslint-disable-next-line no-console
        console.log(
          `Merge with: npx athena merge ${this.options.outputFolder}`,
        );
      }
    } else {
      // eslint-disable-next-line no-console
      console.log(`\nAthena report: ${this.outputFolder}`);
      // eslint-disable-next-line no-console
      console.log(`View with: npx athena show ${this.options.outputFolder}`);
    }

    const shouldOpen =
      this.options.open === 'always' ||
      (this.options.open === 'on-failure' && openStatus !== 'passed');

    // Only auto-open a complete report (unsharded, or merged).
    if (shouldOpen && (!this.shard || merged)) {
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
