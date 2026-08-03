import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertSafeInfrastructurePlan,
  buildComposeArguments,
  buildInfrastructureCommandPlan,
  parseInfrastructureAction,
  persistentVolumeNames,
  type DockerCommandStep,
} from './local-infrastructure-plan.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dockerExecutable = process.env['DOCKER_EXECUTABLE']?.trim() || 'docker';
const bucketName = 'orgawork-files';
const minioContainerName = 'orgawork-minio';

function writeMessage(message: string): void {
  process.stdout.write(`${message}\n`);
}

function runDocker(
  arguments_: readonly string[],
  options: { readonly captureOutput?: boolean } = {},
): string {
  const result = spawnSync(dockerExecutable, [...arguments_], {
    cwd: projectRoot,
    encoding: options.captureOutput ? 'utf8' : undefined,
    env: process.env,
    stdio: options.captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    windowsHide: true,
  });

  if (result.error !== undefined) {
    throw new Error(`اجرای Docker ممکن نشد: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const details = options.captureOutput
      ? `${String(result.stderr).trim()} ${String(result.stdout).trim()}`.trim()
      : '';

    throw new Error(
      `فرمان Docker با کد ${String(result.status)} ناموفق بود${details === '' ? '' : `: ${details}`}`,
    );
  }

  return options.captureOutput ? String(result.stdout).trim() : '';
}

function runStep(step: DockerCommandStep): void {
  writeMessage(`\n${step.description}`);
  const expectsOutput = step.expectedOutput !== undefined;
  const output = runDocker(step.arguments, {
    captureOutput: expectsOutput,
  });

  if (expectsOutput && output !== step.expectedOutput) {
    throw new Error(
      `خروجی فرمان Docker معتبر نیست؛ مقدار مورد انتظار ${step.expectedOutput} و مقدار واقعی ${output} بود.`,
    );
  }

  if (expectsOutput) {
    writeMessage(`پایان موفق با خروجی کنترل‌شده: ${output}`);
  }
}

function isContainerRunning(containerName: string): boolean {
  const output = runDocker(['inspect', '--format', '{{.State.Running}}', containerName], {
    captureOutput: true,
  });

  return output.toLowerCase() === 'true';
}

function reportBucket(): void {
  if (!isContainerRunning(minioContainerName)) {
    writeMessage('وضعیت Bucket بررسی نشد، زیرا MinIO در حال اجرا نیست.');
    return;
  }

  writeMessage('بررسی فقط‌خواندنی Bucket خصوصی MinIO');

  const shellCommand = [
    'set -eu',
    'config_dir=/tmp/orgawork-infrastructure-report',
    'rm -rf "$config_dir"',
    'export MC_CONFIG_DIR="$config_dir"',
    'mc alias set report http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null',
    `mc stat "report/${bucketName}" >/dev/null`,
    `mc anonymous get "report/${bucketName}"`,
    'rm -rf "$config_dir"',
  ].join('; ');

  runDocker(['exec', minioContainerName, 'sh', '-c', shellCommand]);
  writeMessage(`Bucket خصوصی ${bucketName} موجود است.`);
}

function reportVolumes(): void {
  writeMessage('بررسی Volumeهای پایدار');

  for (const volumeName of persistentVolumeNames) {
    const inspectedName = runDocker(['volume', 'inspect', '--format', '{{.Name}}', volumeName], {
      captureOutput: true,
    });

    if (inspectedName !== volumeName) {
      throw new Error(`Volume مورد انتظار پیدا نشد: ${volumeName}`);
    }

    writeMessage(`Volume پایدار موجود است: ${volumeName}`);
  }
}

function reportInfrastructure(): void {
  writeMessage('\nگزارش فقط‌خواندنی زیرساخت محلی');
  runDocker(buildComposeArguments('ps', '-a'));

  try {
    reportBucket();
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('no such object')) {
      writeMessage('وضعیت Bucket بررسی نشد، زیرا Container مربوط به MinIO وجود ندارد.');
    } else {
      throw error;
    }
  }

  reportVolumes();
}

function main(): void {
  const action = parseInfrastructureAction(process.argv[2]);
  const plan = buildInfrastructureCommandPlan(action);

  assertSafeInfrastructurePlan(plan);

  writeMessage(`فرمان زیرساخت انتخاب شد: ${action}`);

  for (const step of plan) {
    runStep(step);
  }

  reportInfrastructure();

  if (action === 'cleanup') {
    writeMessage('پاک‌سازی کنترل‌شده کامل شد؛ Volumeهای پایدار حفظ شدند.');
  } else if (action === 'stop') {
    writeMessage('توقف کنترل‌شده کامل شد؛ Volumeهای پایدار حفظ شدند.');
  } else if (action === 'start') {
    writeMessage('آغاز زیرساخت و ایجاد idempotent Bucket خصوصی کامل شد.');
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`خطای فرمان زیرساخت: ${message}\n`);
  process.exitCode = 1;
}
