import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validateSchedulerProcessOutput,
  validateWorkerProcessOutput,
} from './coordinated-applications-smoke-events.js';

interface CapturedProcess {
  readonly name: string;
  readonly child: ChildProcess;
  stdout: string;
  stderr: string;
}

interface ProcessDefinition {
  readonly name: string;
  readonly command: string;
  readonly arguments: readonly string[];
  readonly workingDirectory: string;
  readonly environment: NodeJS.ProcessEnv;
}

type JsonRecord = Record<string, unknown>;

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const webPath = resolve(projectRoot, 'apps/web');
const apiPath = resolve(projectRoot, 'apps/api');
const workerPath = resolve(projectRoot, 'apps/worker');
const schedulerPath = resolve(projectRoot, 'apps/scheduler');

const webRequire = createRequire(resolve(webPath, 'package.json'));

const nextPackagePath = webRequire.resolve('next/package.json');
const nextExecutablePath = resolve(dirname(nextPackagePath), 'dist/bin/next');

const requiredBuildFiles = [
  resolve(webPath, '.next/BUILD_ID'),
  resolve(apiPath, 'dist/main.js'),
  resolve(workerPath, 'dist/main.js'),
  resolve(schedulerPath, 'dist/main.js'),
  nextExecutablePath,
] as const;

for (const requiredFile of requiredBuildFiles) {
  if (!existsSync(requiredFile)) {
    throw new Error(`خروجی مورد نیاز برای آزمون هماهنگ پیدا نشد: ${requiredFile}`);
  }
}

function writeMessage(message: string): void {
  process.stdout.write(`${message}\n`);
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function startCapturedProcess(definition: ProcessDefinition): CapturedProcess {
  const child = spawn(definition.command, [...definition.arguments], {
    cwd: definition.workingDirectory,
    env: definition.environment,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    windowsHide: true,
  });

  if (child.stdout === null || child.stderr === null) {
    throw new Error(`دریافت خروجی ${definition.name} امکان‌پذیر نیست.`);
  }

  const running: CapturedProcess = {
    name: definition.name,
    child,
    stdout: '',
    stderr: '',
  };

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  child.stdout.on('data', (chunk: string | Buffer) => {
    running.stdout += String(chunk);
  });

  child.stderr.on('data', (chunk: string | Buffer) => {
    running.stderr += String(chunk);
  });

  return running;
}

function stopProcessTree(running: CapturedProcess): void {
  const processId = running.child.pid;

  if (
    processId === undefined ||
    running.child.exitCode !== null ||
    running.child.signalCode !== null
  ) {
    return;
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(processId), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });

    return;
  }

  try {
    process.kill(-processId, 'SIGTERM');
  } catch {
    running.child.kill('SIGTERM');
  }
}

function processFailure(running: CapturedProcess): string {
  return `${running.name} متوقف شد.\n` + `خروجی:\n${running.stdout}\n` + `خطا:\n${running.stderr}`;
}

function waitForExit(running: CapturedProcess, timeoutMilliseconds: number): Promise<number> {
  if (running.child.exitCode !== null) {
    return Promise.resolve(running.child.exitCode);
  }

  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => {
      rejectPromise(new Error(`${running.name} در زمان مقرر متوقف نشد.`));
    }, timeoutMilliseconds);

    function cleanup(): void {
      clearTimeout(timer);
      running.child.removeListener('error', handleError);
      running.child.removeListener('exit', handleExit);
    }

    function handleError(error: Error): void {
      cleanup();
      rejectPromise(error);
    }

    function handleExit(code: number | null, signal: NodeJS.Signals | null): void {
      cleanup();

      if (code === null) {
        rejectPromise(new Error(`${running.name} با پیام ${String(signal)} متوقف شد.`));

        return;
      }

      resolvePromise(code);
    }

    running.child.once('error', handleError);
    running.child.once('exit', handleExit);
  });
}

function isPortListening(host: string, port: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const socket = createConnection({
      host,
      port,
    });

    let settled = false;

    function finish(value: boolean): void {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolvePromise(value);
    }

    socket.setTimeout(500);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

async function waitForPortToClose(host: string, port: number): Promise<void> {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    if (!(await isPortListening(host, port))) {
      return;
    }

    await new Promise((resolvePromise) => {
      setTimeout(resolvePromise, 100);
    });
  }

  throw new Error(`درگاه ${port} پس از آزمون آزاد نشد.`);
}

async function waitForEndpoint(
  running: CapturedProcess,
  url: string,
  validate: (response: Response) => Promise<boolean>,
): Promise<void> {
  let lastError = 'پاسخی دریافت نشد.';

  for (let attempt = 1; attempt <= 60; attempt += 1) {
    if (running.child.exitCode !== null) {
      throw new Error(processFailure(running));
    }

    try {
      const response = await fetch(url, {
        cache: 'no-store',
      });

      if (response.ok && (await validate(response))) {
        return;
      }

      lastError = `پاسخ نامعتبر با وضعیت ${response.status}`;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : 'خطای ناشناخته';
    }

    await new Promise((resolvePromise) => {
      setTimeout(resolvePromise, 250);
    });
  }

  throw new Error(
    `${running.name} در زمان مقرر آماده نشد: ${lastError}\n` + processFailure(running),
  );
}

async function main(): Promise<void> {
  const host = '127.0.0.1';

  for (const port of [3000, 3001] as const) {
    if (await isPortListening(host, port)) {
      throw new Error(`درگاه ${port} پیش از آزمون در حال استفاده است.`);
    }
  }

  const web = startCapturedProcess({
    name: 'رابط کاربری',
    command: process.execPath,
    arguments: [nextExecutablePath, 'start', '--hostname', host, '--port', '3000'],
    workingDirectory: webPath,
    environment: {
      ...process.env,
      NODE_ENV: 'production',
    },
  });

  const api = startCapturedProcess({
    name: 'رابط برنامه‌نویسی',
    command: process.execPath,
    arguments: [resolve(apiPath, 'dist/main.js')],
    workingDirectory: apiPath,
    environment: {
      ...process.env,
      HOST: host,
      PORT: '3001',
      NODE_ENV: 'production',
    },
  });

  const worker = startCapturedProcess({
    name: 'پردازشگر پس‌زمینه',
    command: process.execPath,
    arguments: [resolve(workerPath, 'dist/main.js')],
    workingDirectory: workerPath,
    environment: {
      ...process.env,
      WORKER_NAME: 'orgawork-worker',
      WORKER_POLL_INTERVAL_MS: '250',
      WORKER_RUN_ONCE: 'true',
      NODE_ENV: 'production',
    },
  });

  const scheduler = startCapturedProcess({
    name: 'زمان‌بند',
    command: process.execPath,
    arguments: [resolve(schedulerPath, 'dist/main.js')],
    workingDirectory: schedulerPath,
    environment: {
      ...process.env,
      SCHEDULER_NAME: 'orgawork-scheduler',
      SCHEDULER_INTERVAL_MS: '250',
      SCHEDULER_RUN_ONCE: 'true',
      NODE_ENV: 'production',
    },
  });

  const persistentProcesses = [web, api] as const;

  try {
    const [workerExitCode, schedulerExitCode] = await Promise.all([
      waitForExit(worker, 10_000),
      waitForExit(scheduler, 10_000),
      waitForEndpoint(web, 'http://127.0.0.1:3000', async (response) => {
        const html = await response.text();
        const htmlTag = /<html[^>]*>/u.exec(html)?.[0];

        if (htmlTag === undefined) {
          return false;
        }

        const locale = /\blang="(en|fa)"/u.exec(htmlTag)?.[1];
        const direction = /\bdir="(ltr|rtl)"/u.exec(htmlTag)?.[1];
        const validDirection =
          (locale === 'en' && direction === 'ltr') || (locale === 'fa' && direction === 'rtl');

        return validDirection && /<body(?:\s|>)/u.test(html) && html.includes('/_next/static/');
      }),
      waitForEndpoint(api, 'http://127.0.0.1:3001/health', async (response) => {
        const value = await response.json();

        return (
          isJsonRecord(value) &&
          value['service'] === 'orgawork-api' &&
          value['status'] === 'ok' &&
          typeof value['timestamp'] === 'string'
        );
      }),
    ]);

    validateWorkerProcessOutput(worker, workerExitCode);
    validateSchedulerProcessOutput(scheduler, schedulerExitCode);

    writeMessage('رابط کاربری در درگاه ۳۰۰۰ آماده و معتبر است.');
    writeMessage('رابط برنامه‌نویسی در درگاه ۳۰۰۱ آماده و معتبر است.');
    writeMessage('پردازشگر یک چرخه موفق اجرا کرد و با کد صفر متوقف شد.');
    writeMessage('زمان‌بند یک اجرای موفق ثبت کرد و با کد صفر متوقف شد.');
  } finally {
    for (const running of persistentProcesses) {
      stopProcessTree(running);
    }

    stopProcessTree(worker);
    stopProcessTree(scheduler);

    await Promise.all([waitForPortToClose(host, 3000), waitForPortToClose(host, 3001)]);
  }

  writeMessage('آزمون اجرای هماهنگ چهار برنامه با موفقیت پایان یافت.');
  writeMessage('درگاه‌های ۳۰۰۰ و ۳۰۰۱ آزاد هستند.');
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'خطای ناشناخته رخ داد.';

  process.stderr.write(`آزمون اجرای هماهنگ ناموفق بود:\n${message}\n`);

  process.exitCode = 1;
});
