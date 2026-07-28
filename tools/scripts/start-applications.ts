import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface ApplicationDefinition {
  readonly name: string;
  readonly command: string;
  readonly arguments: readonly string[];
  readonly workingDirectory: string;
  readonly environment: NodeJS.ProcessEnv;
}

interface RunningApplication {
  readonly name: string;
  readonly process: ChildProcess;
}

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
    throw new Error(`خروجی مورد نیاز برای اجرای هماهنگ پیدا نشد: ${requiredFile}`);
  }
}

const definitions: readonly ApplicationDefinition[] = [
  {
    name: 'رابط کاربری',
    command: process.execPath,
    arguments: [nextExecutablePath, 'start', '--hostname', '127.0.0.1', '--port', '3000'],
    workingDirectory: webPath,
    environment: {
      ...process.env,
      NODE_ENV: 'production',
    },
  },
  {
    name: 'رابط برنامه‌نویسی',
    command: process.execPath,
    arguments: [resolve(apiPath, 'dist/main.js')],
    workingDirectory: apiPath,
    environment: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: '3001',
      NODE_ENV: 'production',
    },
  },
  {
    name: 'پردازشگر پس‌زمینه',
    command: process.execPath,
    arguments: [resolve(workerPath, 'dist/main.js')],
    workingDirectory: workerPath,
    environment: {
      ...process.env,
      WORKER_NAME: 'orgawork-worker',
      WORKER_RUN_ONCE: 'false',
      NODE_ENV: 'production',
    },
  },
  {
    name: 'زمان‌بند',
    command: process.execPath,
    arguments: [resolve(schedulerPath, 'dist/main.js')],
    workingDirectory: schedulerPath,
    environment: {
      ...process.env,
      SCHEDULER_NAME: 'orgawork-scheduler',
      SCHEDULER_RUN_ONCE: 'false',
      NODE_ENV: 'production',
    },
  },
];

const runningApplications: RunningApplication[] = [];
let shuttingDown = false;

function writeMessage(message: string): void {
  process.stdout.write(`${message}\n`);
}

function stopProcessTree(child: ChildProcess): void {
  const processId = child.pid;

  if (processId === undefined || child.exitCode !== null || child.signalCode !== null) {
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
    child.kill('SIGTERM');
  }
}

function shutdown(reason: string, exitCode = 0): void {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  process.exitCode = exitCode;

  writeMessage(`توقف هماهنگ برنامه‌ها آغاز شد: ${reason}`);

  for (const application of [...runningApplications].reverse()) {
    stopProcessTree(application.process);
  }
}

for (const definition of definitions) {
  const child = spawn(definition.command, [...definition.arguments], {
    cwd: definition.workingDirectory,
    env: definition.environment,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    windowsHide: false,
  });

  runningApplications.push({
    name: definition.name,
    process: child,
  });

  writeMessage(`${definition.name} آغاز شد؛ شناسه فرایند: ${child.pid ?? 'نامشخص'}`);

  child.once('error', (error: Error) => {
    process.stderr.write(`${definition.name} اجرا نشد: ${error.message}\n`);

    shutdown(`خطای اجرای ${definition.name}`, 1);
  });

  child.once('exit', (code: number | null, signal: NodeJS.Signals | null) => {
    if (shuttingDown) {
      return;
    }

    process.stderr.write(
      `${definition.name} به‌طور غیرمنتظره متوقف شد؛ ` +
        `کد: ${String(code)}، پیام: ${String(signal)}\n`,
    );

    shutdown(`توقف غیرمنتظره ${definition.name}`, code ?? 1);
  });
}

process.once('SIGINT', () => {
  shutdown('دریافت فرمان توقف');
});

process.once('SIGTERM', () => {
  shutdown('دریافت فرمان پایان');
});

writeMessage('چهار برنامه به‌صورت هماهنگ آغاز شدند. برای توقف از کلیدهای کنترل و سی استفاده کنید.');
