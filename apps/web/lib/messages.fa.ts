export const userFacingMessages = {
  application: {
    name: 'سامانه پیگیری سازمانی',
    description: 'سامانه فارسی مدیریت پرونده‌ها، اقدامات، پیگیری‌ها، یادآورها و گزارش‌های سازمانی',
  },
  home: {
    eyebrow: 'سامانه پیگیری سازمانی',
    title: 'پایه رابط کاربری با موفقیت راه‌اندازی شد',
    description:
      'این سامانه از ابتدا با زبان فارسی روان، چیدمان راست‌به‌چپ و تقویم هجری شمسی توسعه داده می‌شود.',
    foundationItems: [
      'مدیریت پرونده‌ها و اقدامات',
      'پیگیری مسئولیت‌ها و موعدها',
      'یادآوری و هشدارهای سازمانی',
      'گزارش‌های شخصی و مدیریتی',
    ],
    foundationItemsLabel: 'قابلیت‌های اصلی سامانه',
    readyStatus: 'مرحله پایه رابط کاربری آماده است',
  },
} as const;

type MessageValue =
  | string
  | readonly string[]
  | {
      readonly [key: string]: MessageValue;
    };

function isStringArray(value: MessageValue): value is readonly string[] {
  return Array.isArray(value);
}

export function collectUserFacingTexts(value: MessageValue): readonly string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (isStringArray(value)) {
    return value;
  }

  const texts: string[] = [];

  for (const key of Object.keys(value)) {
    const nestedValue = value[key];

    if (nestedValue !== undefined) {
      texts.push(...collectUserFacingTexts(nestedValue));
    }
  }

  return texts;
}
