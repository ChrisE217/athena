import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      'reporter/index': 'src/reporter/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: false,
    target: 'node18',
    external: ['@playwright/test'],
    shims: true,
  },
  {
    entry: {
      cli: 'src/cli.ts',
    },
    format: ['esm'],
    dts: false,
    clean: false,
    sourcemap: false,
    target: 'node18',
    shims: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
