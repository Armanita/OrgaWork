# مستندات OrgaWork

## Active Working Set

برای کار روزمره فقط این مجموعه منبع فعال است:

| فایل                            | مسئولیت                                      |
| ------------------------------- | -------------------------------------------- |
| `../project-state.json`         | وضعیت machine-readable فعلی                  |
| `../ORGAWORK-MASTER-HANDOFF.md` | ادامه پروژه و Next Action                    |
| `PROJECT-STATUS.md`             | خلاصه وضعیت انسانی                           |
| `ROADMAP.md`                    | Capabilityها، Milestoneها و Vertical Sliceها |
| `ARCHITECTURE.md`               | معماری فنی و مرزهای کد                       |
| `QUALITY.md`                    | مدل تست و Verification                       |
| `DECISIONS.md`                  | تصمیم‌های الزام‌آور                          |
| `PRODUCT-SPECIFICATION.md`      | دامنه محصول                                  |
| `APPROVED-BASELINES.md`         | baselineهای پذیرفته‌شده                      |

هدف این مجموعه کوچک این است که ادامه پروژه نیازمند خواندن هزاران خط تاریخچه نباشد.

## Reference / History

این اسناد حذف نمی‌شوند و همچنان برای Evidence، جزئیات عملیاتی یا تاریخچه قابل استفاده‌اند، اما **مدل اجرای جاری را تعریف نمی‌کنند**:

- `IMPLEMENTATION-JOURNAL.md`
- `TRACEABILITY-MATRIX.md`
- `CONTINUATION-PROTOCOL.md`
- `VERIFICATION-SYSTEM.md`
- `TEST-AND-ACCEPTANCE.md`
- `DEVELOPMENT-RUNBOOK.md`
- `DOCUMENTATION-CHANGE-POLICY.md`
- `RISKS-ASSUMPTIONS-DEBT.md`
- `DOMAIN-GLOSSARY.md`
- `acceptance/*`
- `contracts/*`
- `spikes/*`
- `history/*`

هر متن P-stage در این اسناد تاریخی است مگر اینکه یک تصمیم فعلی صریحاً دوباره آن را فعال کرده باشد.

## اصل منبع حقیقت

برای وضعیت جاری:

`project-state.json` -> `PROJECT-STATUS.md` -> `ROADMAP.md` -> Git/Remote

برای تصمیم معماری:

`DECISIONS.md` و `ARCHITECTURE.md`

برای تاریخچه پذیرفته‌شده:

Commit/Tag/Evidence و اسناد Acceptance تاریخی.

## UI

Foundation رابط کاربری حفظ شده است. تصمیم P2R درباره Design System، Dashboard shell، `next-intl`، LTR/RTL، Vazirmatn و مراجع Studio Admin / Kiranism / TailAdmin همچنان معتبر است.

از این پس UI یک Stage جدا در انتهای Capability نیست. هر Slice کاربرمحور بدون UI لازم، Done نیست.

## به‌روزرسانی اسناد

- Task و Patch عادی: سند لازم نیست، مگر تصمیم یا قرارداد عوض شود.
- پایان Slice: فقط اگر رفتار عمومی یا قرارداد عوض شده باشد.
- پایان Milestone: Status، Roadmap، Traceability و Decisionهای مرتبط batch می‌شوند.
- Release: مستندات و شواهد کامل بازبینی می‌شوند.

تاریخچه قبلی پاک یا بازنویسی نمی‌شود.
