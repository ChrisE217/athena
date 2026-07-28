import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.zip': 'application/zip',
  '.md': 'text/markdown; charset=utf-8',
};

function printHelp(): void {
  console.log(`Athena — Playwright report viewer

Usage:
  athena show [reportDir] [--port 9324] [--no-open]
  athena trace <trace.zip>

Options:
  --port <n>   Port for static server (default 9324)
  --no-open    Do not open a browser
`);
}

function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd =
    platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
}

async function showReport(args: string[]): Promise<void> {
  let reportDir = 'athena-report';
  let port = 9324;
  let shouldOpen = true;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--no-open') shouldOpen = false;
    else if (a === '--port') {
      port = Number(args[++i]);
    } else if (!a.startsWith('-')) {
      reportDir = a;
    }
  }

  const root = resolve(process.cwd(), reportDir);
  if (!existsSync(join(root, 'index.html'))) {
    console.error(`No Athena report found at ${root}`);
    process.exit(1);
  }

  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
      let pathname = decodeURIComponent(url.pathname);

      if (pathname === '/__athena/meta') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, features: ['open-trace'] }));
        return;
      }

      if (pathname === '/__athena/open-trace') {
        const rel = url.searchParams.get('path') || '';
        const traceFile = normalize(join(root, rel));
        if (!rel || !traceFile.startsWith(root) || !existsSync(traceFile)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Trace not found' }));
          return;
        }
        spawn(
          process.platform === 'win32' ? 'npx.cmd' : 'npx',
          ['playwright', 'show-trace', traceFile],
          { stdio: 'ignore', detached: true, shell: process.platform === 'win32' },
        ).unref();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (pathname === '/') pathname = '/index.html';

      const filePath = normalize(join(root, pathname));
      if (!filePath.startsWith(root)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(readFileSync(filePath));
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  });


  await new Promise<void>((resolveListen) => {
    server.listen(port, '127.0.0.1', () => resolveListen());
  });

  const url = `http://127.0.0.1:${port}`;
  console.log(`Athena report at ${url}`);
  console.log(`Serving ${root}`);
  if (shouldOpen) openBrowser(url);
}

function showTrace(args: string[]): void {
  const tracePath = args[0];
  if (!tracePath) {
    console.error('Usage: athena trace <trace.zip>');
    process.exit(1);
  }
  const resolved = resolve(process.cwd(), tracePath);
  if (!existsSync(resolved)) {
    console.error(`Trace not found: ${resolved}`);
    process.exit(1);
  }

  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['playwright', 'show-trace', resolved],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );
  child.on('exit', (code) => process.exit(code ?? 0));
}

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }
  if (command === 'show') {
    await showReport(rest);
    return;
  }
  if (command === 'trace') {
    showTrace(rest);
    return;
  }

  // Allow `athena <dir>` as shorthand for show
  if (!command.startsWith('-') && existsSync(resolve(process.cwd(), command, 'index.html'))) {
    await showReport([command, ...rest]);
    return;
  }

  printHelp();
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
