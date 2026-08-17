export const testTimeoutPolicy = {
  unitMs: 5_000,
  acceptanceMs: 30_000,
  publicationMs: 60_000,
} as const;

export type TestTimeoutClass = keyof typeof testTimeoutPolicy;

export function timeoutForTestClass(testClass: TestTimeoutClass): number {
  return testTimeoutPolicy[testClass];
}
