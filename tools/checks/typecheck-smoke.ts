type ProjectStage = {
  readonly code: string;
  readonly title: string;
  readonly completed: boolean;
};

const currentStage: ProjectStage = {
  code: 'P1.2',
  title: 'تنظیم ابزارهای پایه توسعه',
  completed: false,
};

export function getCurrentStage(): ProjectStage {
  return currentStage;
}
