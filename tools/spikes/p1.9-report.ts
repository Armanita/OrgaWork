import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { assertArchitecture } from '../checks/architecture-policy.js';
import { p19TechnicalSpikes } from './p1.9-catalog.js';

export interface P19SpikeSummary {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly stage: 'P1.9';
  readonly classification: 'technical-spike';
  readonly architecture: {
    readonly workspaces: number;
    readonly sourceFiles: number;
    readonly issues: 0;
  };
  readonly migrationMarkers: Readonly<Record<string, boolean>>;
  readonly realInfrastructureEvidence: boolean;
  readonly spikes: typeof p19TechnicalSpikes;
}

export function renderP19Markdown(summary: P19SpikeSummary): string {
  const lines = [
    '# گزارش بررسی‌های فنی P1.9',
    '',
    `- زمان تولید: ${summary.generatedAt}`,
    `- Workspaceهای بررسی‌شده: ${String(summary.architecture.workspaces)}`,
    `- فایل‌های منبع بررسی‌شده: ${String(summary.architecture.sourceFiles)}`,
    `- شاهد زیرساخت واقعی: ${summary.realInfrastructureEvidence ? 'موجود' : 'ناموجود'}`,
    '',
  ];

  for (const spike of summary.spikes) {
    lines.push(`## ${spike.id} — ${spike.title}`);
    lines.push('');
    lines.push(`- سؤال: ${spike.question}`);
    lines.push(`- تصمیم: ${spike.decision.status} — ${spike.decision.text}`);
    lines.push(`- محدودیت: ${spike.limitations.join(' | ')}`);
    lines.push(`- بدهی: ${spike.technicalDebt.join(' | ')}`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

export function createP19SpikeReport(repository: string, now: Date = new Date()): P19SpikeSummary {
  const architecture = assertArchitecture(repository);
  const migration = readFileSync(
    resolve(repository, 'infra/migrations/0003_create-tenant-runtime-infrastructure.sql'),
    'utf8',
  );
  const outputDirectory = resolve(repository, 'artifacts/spikes');
  mkdirSync(outputDirectory, { recursive: true });

  const summary: P19SpikeSummary = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    stage: 'P1.9',
    classification: 'technical-spike',
    architecture: {
      workspaces: architecture.workspaces.length,
      sourceFiles: architecture.sourceFiles,
      issues: 0,
    },
    migrationMarkers: {
      outboxCompositeUnique: migration.includes('UNIQUE (organization_id, idempotency_key)'),
      inboxCompositeUnique: migration.includes(
        'UNIQUE (organization_id, consumer_name, message_id)',
      ),
      rowLevelSecurityForced: migration.includes('FORCE ROW LEVEL SECURITY'),
      transactionContext: migration.includes('orgawork_current_organization_id'),
    },
    realInfrastructureEvidence: existsSync(
      resolve(repository, 'artifacts/spikes/p1.9-real-infrastructure.json'),
    ),
    spikes: p19TechnicalSpikes,
  };

  writeFileSync(
    resolve(outputDirectory, 'p1.9-summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(resolve(outputDirectory, 'p1.9-summary.md'), renderP19Markdown(summary), 'utf8');

  return summary;
}

function isMainModule(): boolean {
  const argument = process.argv[1];
  return argument !== undefined && import.meta.url === pathToFileURL(resolve(argument)).href;
}

if (isMainModule()) {
  const report = createP19SpikeReport(process.cwd());
  process.stdout.write(
    `P1.9_SPIKE_REPORT_CREATED: artifacts/spikes/p1.9-summary.json workspaces=${String(report.architecture.workspaces)} sourceFiles=${String(report.architecture.sourceFiles)}\n`,
  );
}
