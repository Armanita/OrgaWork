import faMessages from '@/messages/fa.json';

export const userFacingMessages = faMessages;

type MessageValue =
  | string
  | number
  | boolean
  | null
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

  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return [];
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
