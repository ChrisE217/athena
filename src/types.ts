export type TestOutcome = 'passed' | 'failed' | 'flaky' | 'skipped' | 'timedOut' | 'interrupted';

export type AttemptStatus = 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';

export interface AthenaAttachment {
  name: string;
  contentType: string;
  path: string;
  kind: 'screenshot' | 'video' | 'trace' | 'snapshot' | 'other';
}

export interface AthenaError {
  message: string;
  stack?: string;
  snippet?: string;
  location?: {
    file: string;
    line: number;
    column?: number;
  };
  value?: string;
}

export interface AthenaStep {
  title: string;
  category?: string;
  duration: number;
  error?: AthenaError;
  failed: boolean;
  steps: AthenaStep[];
}

export interface AthenaAttempt {
  retry: number;
  status: AttemptStatus;
  duration: number;
  startTime: string;
  errors: AthenaError[];
  steps: AthenaStep[];
  attachments: AthenaAttachment[];
  stdout?: string;
  stderr?: string;
}

export interface AthenaAnnotation {
  type: string;
  description?: string;
}

export interface AthenaTest {
  id: string;
  title: string;
  titlePath: string[];
  file: string;
  line: number;
  column: number;
  projectName: string;
  outcome: TestOutcome;
  duration: number;
  retries: number;
  tags: string[];
  annotations: AthenaAnnotation[];
  attempts: AthenaAttempt[];
}

export interface AthenaSuiteNode {
  id: string;
  title: string;
  file?: string;
  duration: number;
  counts: Record<TestOutcome, number>;
  suites: AthenaSuiteNode[];
  tests: AthenaTest[];
}

export interface AthenaStats {
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  timedOut: number;
  interrupted: number;
  passRate: number;
  duration: number;
}

export interface AthenaReport {
  version: 1;
  title: string;
  generatedAt: string;
  startTime: string;
  duration: number;
  status: 'passed' | 'failed' | 'timedout' | 'interrupted';
  stats: AthenaStats;
  config: {
    rootDir: string;
    projects: string[];
    workers?: number;
  };
  suites: AthenaSuiteNode[];
  tests: AthenaTest[];
}

export interface AthenaReporterOptions {
  outputFolder?: string;
  open?: 'never' | 'always' | 'on-failure';
  title?: string;
}
