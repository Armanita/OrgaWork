import { describe, expect, it } from 'vitest';

import { resolveRuntimeConfiguration } from './runtime-configuration.js';

describe('پیکربندی اجرای رابط برنامه‌نویسی', () => {
  it('مقادیر پیش‌فرض را برمی‌گرداند', () => {
    expect(resolveRuntimeConfiguration({})).toEqual({
      host: '127.0.0.1',
      port: 3001,
    });
  });

  it('مقادیر معتبر محیط اجرا را می‌پذیرد', () => {
    expect(
      resolveRuntimeConfiguration({
        HOST: ' 0.0.0.0 ',
        PORT: '8080',
      }),
    ).toEqual({
      host: '0.0.0.0',
      port: 8080,
    });
  });

  it.each(['0', '65536', '12.5', 'نامعتبر'])('درگاه نامعتبر %s را رد می‌کند', (port) => {
    expect(() =>
      resolveRuntimeConfiguration({
        PORT: port,
      }),
    ).toThrow('مقدار درگاه اجرا باید عددی صحیح بین ۱ تا ۶۵۵۳۵ باشد.');
  });
});
