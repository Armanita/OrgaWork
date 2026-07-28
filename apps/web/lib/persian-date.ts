const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;

function convertToPersianDigits(value: string): string {
  return value.replace(/\d/gu, (digit) => {
    const index = Number(digit);
    return persianDigits[index] ?? digit;
  });
}

function readDatePart(
  parts: readonly Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  const part = parts.find((item) => item.type === type);

  if (!part) {
    throw new Error(`بخش تاریخ پیدا نشد: ${type}`);
  }

  return part.value;
}

export function formatPersianDate(value: Date, timeZone: string): string {
  if (Number.isNaN(value.getTime())) {
    throw new RangeError('تاریخ واردشده معتبر نیست.');
  }

  if (timeZone.trim() === '') {
    throw new RangeError('منطقه زمانی نمی‌تواند خالی باشد.');
  }

  const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
    calendar: 'persian',
    numberingSystem: 'latn',
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });

  const parts = formatter.formatToParts(value);
  const year = readDatePart(parts, 'year');
  const month = readDatePart(parts, 'month').padStart(2, '0');
  const day = readDatePart(parts, 'day').padStart(2, '0');

  return convertToPersianDigits(`${year}/${month}/${day}`);
}
