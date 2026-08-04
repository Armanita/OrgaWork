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
  navigation: {
    overview: 'نمای کلی',
    members: 'اعضا و دعوت‌ها',
    teams: 'تیم‌ها',
    security: 'ورود و امنیت',
  },
  login: {
    title: 'ورود به سامانه',
    description: 'برای ادامه ایمیل و گذرواژه حساب سازمانی خود را وارد کنید.',
    email: 'ایمیل',
    password: 'گذرواژه',
    submit: 'ورود',
    forgot: 'بازیابی گذرواژه',
  },
  organization: {
    title: 'انتخاب سازمان جاری',
    description:
      'سازمانی را انتخاب کنید که می‌خواهید پرونده‌ها اعضا تیم‌ها و دسترسی‌های آن را مدیریت کنید.',
    switchAction: 'انتخاب سازمان',
  },
  members: {
    title: 'مدیریت اعضا و دعوت‌ها',
    invite: 'دعوت عضو جدید',
  },
  teams: {
    title: 'مدیریت تیم‌ها',
    create: 'ایجاد تیم جدید',
  },
  dashboard: {
    eyebrow: 'مرکز مدیریت سازمان',
    title: 'نمای کلی هویت و دسترسی',
    description:
      'وضعیت اعضا تیم‌ها نشست‌های فعال و تغییرات دسترسی سازمان جاری را در یک نگاه بررسی کنید.',
    cards: [
      ['اعضای فعال', '۱۲'],
      ['دعوت‌های در انتظار', '۳'],
      ['تیم‌های فعال', '۵'],
      ['نشست‌های فعال', '۸'],
    ],
  },
} as const;

type MessageValue =
  | string
  | readonly MessageValue[]
  | {
      readonly [key: string]: MessageValue;
    };

function isMessageArray(value: MessageValue): value is readonly MessageValue[] {
  return Array.isArray(value);
}

export function collectUserFacingTexts(value: MessageValue): readonly string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (isMessageArray(value)) {
    const texts: string[] = [];

    for (const nestedValue of value) {
      texts.push(...collectUserFacingTexts(nestedValue));
    }

    return texts;
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
