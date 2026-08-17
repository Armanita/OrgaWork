export interface ParsedStageReference {
  readonly raw: string;
  readonly id: string;
  readonly major: number;
  readonly minor?: number;
}

export function parseStageReference(value: string): ParsedStageReference | undefined {
  const trimmed = value.trim();
  const match = /^P(\d+)(?:\.(\d+))?(?=\s|—|-|$)/u.exec(trimmed);
  const majorText = match?.[1];
  if (majorText === undefined) {
    return undefined;
  }

  const minorText = match?.[2];
  const major = Number.parseInt(majorText, 10);
  const minor = minorText === undefined ? undefined : Number.parseInt(minorText, 10);

  return {
    raw: trimmed,
    id: minor === undefined ? `P${major}` : `P${major}.${minor}`,
    major,
    ...(minor === undefined ? {} : { minor }),
  };
}

export function isAtOrBeyondMajorStage(value: string, minimumMajor: number): boolean {
  const parsed = parseStageReference(value);
  return parsed !== undefined && parsed.major >= minimumMajor;
}

export function isAtOrBeyondStage(
  value: string,
  minimumMajor: number,
  minimumMinor: number,
): boolean {
  const parsed = parseStageReference(value);
  if (parsed === undefined) {
    return false;
  }

  if (parsed.major > minimumMajor) {
    return true;
  }

  return parsed.major === minimumMajor && (parsed.minor ?? 0) >= minimumMinor;
}

export function roadmapCurrentStage(roadmap: string): string | undefined {
  return /^- مرحله جاری: `([^`]+)`/mu.exec(roadmap)?.[1];
}

export function statusCurrentSubstage(status: string): string | undefined {
  return /^- زیرمرحله جاری: `([^`]+)`/mu.exec(status)?.[1];
}

export function roadmapStageChecked(roadmap: string, stageId: string): boolean {
  const escaped = stageId.replaceAll('.', String.raw`\.`);
  return new RegExp(String.raw`^- \[x\] ${escaped}(?:\s|$)`, 'mu').test(roadmap);
}

export function roadmapStageOpen(roadmap: string, stageId: string): boolean {
  const escaped = stageId.replaceAll('.', String.raw`\.`);
  return new RegExp(String.raw`^- \[ \] ${escaped}(?:\s|$)`, 'mu').test(roadmap);
}
