<!-- ORGAWORK:EXECUTION-MODEL-V2-NOTICE -->
> **Active model notice - 2026-08-19**
>
> مدل اجرایی جاری OrgaWork اکنون `Capability + Vertical Slice` است. برای وضعیت و ترتیب جاری به `project-state.json`، `ORGAWORK-MASTER-HANDOFF.md`، `docs/PROJECT-STATUS.md`، `docs/ROADMAP.md`، `docs/ARCHITECTURE.md` و `docs/QUALITY.md` مراجعه کن.
>
> بدنه تاریخی این سند برای Evidence، جزئیات یا مرجع گذشته حفظ شده است. هر دستور P-stage، current-stage یا الزام per-substage که با منابع فعال بالا تعارض داشته باشد، برای اجرای آینده non-operative است. محتوای فنی/عملیاتی غیرمتعارض همچنان قابل استفاده است.

# ماتریس ردیابی OrgaWork

## 1. شناسنامه سند

- شناسه سند: `TRACEABILITY-MATRIX`
- نسخه: `0.1.0`
- وضعیت: ماتریس رسمی ردیابی نیاز، تصمیم، مرحله، پیاده‌سازی، آزمون و شاهد
- تاریخ ایجاد: `2026-07-28`
- شاخه مرجع: `main`
- مسیر مرجع مخزن:

```text
C:\Users\Abtin Akbari\Desktop\OrgaWork
```

- اسناد مرتبط:
  - `README.md`
  - `PROJECT-STATUS.md`
  - `ROADMAP.md`
  - `IMPLEMENTATION-JOURNAL.md`
  - `DECISIONS.md`
  - `APPROVED-BASELINES.md`
  - `PRODUCT-SPECIFICATION.md`
  - `DOMAIN-GLOSSARY.md`
  - `DEVELOPMENT-RUNBOOK.md`
  - `CONTINUATION-PROTOCOL.md`
  - `TEST-AND-ACCEPTANCE.md`
  - `RISKS-ASSUMPTIONS-DEBT.md`
  - `DOCUMENTATION-CHANGE-POLICY.md`

## 2. هدف

این سند ارتباط دوسویه میان نیازهای محصول، تصمیم‌های رسمی، مراحل Roadmap، کد، آزمون، شواهد و ریسک‌ها را نگهداری می‌کند.

این ماتریس باید پاسخ دهد:

- هر نیاز از کدام سند آمده است؟
- مالک پیاده‌سازی آن کدام مرحله است؟
- چه تصمیمی بر آن اثر دارد؟
- کدام جزء آن را اجرا می‌کند؟
- کدام آزمون آن را اثبات می‌کند؟
- آخرین شاهد معتبر چیست؟
- چه ریسک یا تصمیم بازی مانع تکمیل آن است؟
- وضعیت واقعی آن چیست؟

## 3. دامنه اثر

ردیابی برای محصول، معماری، زبان، زمان، هویت، سازمان، مجوز، RLS، پرونده، اقدام، یادآور، فایل، گزارش، جست‌وجو، زیرساخت، قرارداد، امنیت، آزمون، استقرار، عملیات و مستندات الزامی است.

## 4. اصل ردیابی دوسویه

ردیابی باید هم از نیاز به تصمیم، کد، آزمون و شاهد، و هم از کد یا آزمون به نیاز و تصمیم مالک ممکن باشد.

کد بدون نیاز یا تصمیم قابل ردیابی باید بررسی شود. نیاز بدون مرحله، آزمون یا معیار پذیرش نیز ناقص است.

## 5. اصل عدم ادعای بیش از واقعیت

وجود ردیف در این ماتریس به معنی پیاده‌سازی نیست. وضعیت هر ردیف باید صریح و قابل اثبات باشد.

## 6. شناسه‌های رسمی

الگوهای شناسه:

```text
REQ-###   نیاز محصول یا دامنه
TECH-###  قاعده فنی و معماری
ACC-###   معیار پذیرش
EVD-###   شاهد
GAP-###   شکاف ردیابی
```

## 7. وضعیت‌های مجاز

- `مصوب`
- `برنامه‌ریزی‌شده`
- `در حال پیاده‌سازی`
- `پیاده‌سازی‌شده`
- `آزموده‌شده`
- `پذیرفته‌شده`
- `مسدود`
- `منسوخ`
- `خارج از دامنه فعلی`

## 8. معنای وضعیت‌ها

- **مصوب:** معنا یا تصمیم پذیرفته شده است، اما لزوماً کد ندارد.
- **برنامه‌ریزی‌شده:** مرحله مالک مشخص است، اما پیاده‌سازی آغاز نشده است.
- **پیاده‌سازی‌شده:** کد وجود دارد، اما همه معیارهای پذیرش اثبات نشده‌اند.
- **آزموده‌شده:** آزمون مرتبط موفق است، اما ممکن است Commit یا Tag مرحله باقی مانده باشد.
- **پذیرفته‌شده:** معیارها، شاهد، Commit و Tag متناسب وجود دارند.
- **مسدود:** وابستگی، ریسک، تصمیم باز یا شکست مانع ادامه است.

## 9. ستون‌های ماتریس

هر ردیف متناسب با نوع خود باید این ستون‌ها را داشته باشد:

- شناسه؛
- عنوان؛
- منبع؛
- مالک؛
- تصمیم مرتبط؛
- جزء پیاده‌سازی؛
- آزمون؛
- شاهد؛
- وضعیت؛
- شکاف یا ریسک.

## 10. ترتیب اعتبار منابع

در تعارض:

1. واقعیت قابل اجرای کد و Migration؛
2. Commit و Tag رسمی؛
3. `DECISIONS.md` و `APPROVED-BASELINES.md`؛
4. `PRODUCT-SPECIFICATION.md`؛
5. `PROJECT-STATUS.md`؛
6. `ROADMAP.md`؛
7. اسناد تخصصی؛
8. `IMPLEMENTATION-JOURNAL.md`؛
9. آرشیو؛
10. گفت‌وگو.

## 11. قاعده آرشیو

آرشیو فقط شاهد تاریخی یا منبع مقایسه است و مرجع وضعیت فعلی، پشته، Contract، Schema یا سطح تکمیل نیست.

## 12. قاعده تصمیم باز

تصمیم باز می‌تواند در ماتریس ثبت شود، اما تا بسته‌شدن آن نباید مقدار فنی حدسی در ستون پیاده‌سازی وارد شود.

## 13. قاعده ریسک

ریسک فعال باید به ردیف‌های اثرپذیر متصل شود. ریسک بحرانی حل‌نشده مانع پذیرش ردیف مربوط است.

## 14. خط‌مبناهای P0

| شناسه      | خط‌مبنا           | نقش در ردیابی                  | وضعیت       |
| ---------- | ----------------- | ------------------------------ | ----------- |
| `BASE-001` | `MASTER-SPEC-001` | نیازهای سطح‌بالای محصول        | پذیرفته‌شده |
| `BASE-002` | `ADR-001..010`    | تصمیم‌های معماری و فنی         | پذیرفته‌شده |
| `BASE-003` | `DDM-001`         | مدل دامنه                      | پذیرفته‌شده |
| `BASE-004` | `DBS-001`         | پایگاه داده و جداسازی          | پذیرفته‌شده |
| `BASE-005` | `ACS-001`         | دسترسی و امنیت                 | پذیرفته‌شده |
| `BASE-006` | `UXS-001`         | تجربه فارسی و RTL              | پذیرفته‌شده |
| `BASE-007` | `DRS-001`         | آمادگی توسعه و آغاز پیاده‌سازی | پذیرفته‌شده |

## 15. محدودیت بازگویی ADRها

عنوان و محتوای دقیق هر ADR باید از سند مصوب خوانده شود و در این ماتریس از روی حافظه بازسازی نمی‌شود.

## 16. تفسیر قطعی DRS-001

`DRS-001` دروازه آمادگی توسعه و برنامه آغاز پیاده‌سازی است و به گزارش یا داشبورد P8 اشاره نمی‌کند.

## 17. REQ-001 — رابط عمومی فارسی

| فیلد     | مقدار                            |
| -------- | -------------------------------- |
| منبع     | Product Spec، UXS-001، Decisions |
| مالک     | همه مراحل دارای UI               |
| جزء فعلی | apps/web                         |
| آزمون    | آزمون متن پایه و Smoke           |
| شاهد     | EVD-003 و EVD-008                |
| وضعیت    | آزموده‌شده                       |
| شکاف     | گسترش به صفحات دامنه             |

## 18. REQ-002 — رابط راست‌به‌چپ

| فیلد     | مقدار                |
| -------- | -------------------- |
| منبع     | UXS-001              |
| مالک     | Web                  |
| جزء فعلی | Root Layout          |
| آزمون    | بررسی dir=rtl        |
| شاهد     | EVD-003              |
| وضعیت    | آزموده‌شده           |
| شکاف     | پوشش مؤلفه‌های آینده |

## 19. REQ-003 — عدم نمایش انگلیسی خام

| فیلد     | مقدار                    |
| -------- | ------------------------ |
| منبع     | Product Spec و Decisions |
| مالک     | تمام خروجی‌های عمومی     |
| جزء فعلی | صفحه پایه Web            |
| آزمون    | Smoke و مرورگر           |
| شاهد     | EVD-008                  |
| وضعیت    | آزموده‌شده در Bootstrap  |
| شکاف     | خطا، گزارش و اعلان آینده |

## 20. REQ-004 — تاریخ عمومی هجری شمسی

| فیلد     | مقدار                           |
| -------- | ------------------------------- |
| منبع     | Product Spec، Glossary، UXS-001 |
| مالک     | Web، Report، Notification       |
| جزء فعلی | Formatter پایه Web              |
| آزمون    | Unit و مرورگر پایه              |
| شاهد     | EVD-003                         |
| وضعیت    | آزموده‌شده پایه                 |
| شکاف     | Input، Parse، DST و گزارش       |

## 21. REQ-005 — زمان فنی UTC و ISO

| فیلد     | مقدار                       |
| -------- | --------------------------- |
| منبع     | Decisions و Glossary        |
| مالک     | تمام سرویس‌ها               |
| جزء فعلی | API، Worker، Scheduler      |
| آزمون    | Timestamp و Structured Log  |
| شاهد     | EVD-004 تا EVD-006          |
| وضعیت    | آزموده‌شده در Bootstrap     |
| شکاف     | DB، Message، Audit و Report |

## 22. REQ-006 — منطقه زمانی IANA

| فیلد     | مقدار                   |
| -------- | ----------------------- |
| منبع     | Product Spec و Glossary |
| مالک     | Web و Reminder          |
| جزء فعلی | Formatter پایه          |
| آزمون    | آزمون منطقه زمانی پایه  |
| شاهد     | EVD-003                 |
| وضعیت    | پیاده‌سازی‌شده پایه     |
| شکاف     | Contract ورودی و DST    |

## 23. REQ-007 — خطای عمومی فارسی و امن

| فیلد     | مقدار                      |
| -------- | -------------------------- |
| منبع     | Product Spec و Test Policy |
| مالک     | API و Web                  |
| جزء فعلی | هنوز Contract نهایی ندارد  |
| آزمون    | Contract و UI Error Test   |
| شاهد     | ندارد                      |
| وضعیت    | برنامه‌ریزی‌شده            |
| شکاف     | Error Envelope در P1.6     |

## 24. REQ-008 — دسترس‌پذیری

| فیلد     | مقدار                            |
| -------- | -------------------------------- |
| منبع     | Product Spec و UXS-001           |
| مالک     | Web                              |
| جزء فعلی | Bootstrap محدود                  |
| آزمون    | Keyboard، Focus، Label، Contrast |
| شاهد     | ندارد                            |
| وضعیت    | برنامه‌ریزی‌شده                  |
| شکاف     | صفحات واقعی و مرورگر هدف         |

## 25. REQ-009 — پرونده ظرف اصلی پیگیری

| فیلد     | مقدار                           |
| -------- | ------------------------------- |
| منبع     | Product Spec، DDM-001، Glossary |
| مالک     | P3                              |
| جزء فعلی | قرارداد `modules/cases`         |
| آزمون    | Domain Contract                 |
| شاهد     | `P34.C1`                        |
| وضعیت    | قرارداد تثبیت‌شده               |
| شکاف     | Persistence و API اجرایی        |

## 26. REQ-010 — مسئولیت مستقل از مجوز

| فیلد     | مقدار                           |
| -------- | ------------------------------- |
| منبع     | Product Spec، Glossary، ACS-001 |
| مالک     | P2 و P3                         |
| جزء فعلی | قرارداد `modules/assignments`   |
| آزمون    | Domain و Permission Contract    |
| شاهد     | `P34.C1`                        |
| وضعیت    | قرارداد تثبیت‌شده               |
| شکاف     | Policy اجرایی و Persistence     |

## 27. REQ-011 — یک مسئول اصلی غیرمتناقض

| فیلد     | مقدار                 |
| -------- | --------------------- |
| منبع     | Glossary              |
| مالک     | P3                    |
| جزء فعلی | قرارداد مسئولیت اصلی  |
| آزمون    | Domain Constraint     |
| شاهد     | `P34.C1`              |
| وضعیت    | قرارداد تثبیت‌شده     |
| شکاف     | قید SQL و Concurrency |

## 28. REQ-012 — یک کار جاری اصلی غیرمتناقض

| فیلد     | مقدار                   |
| -------- | ----------------------- |
| منبع     | Product Spec و Glossary |
| مالک     | P3 و P4                 |
| جزء فعلی | `CurrentWorkReference`  |
| آزمون    | Domain Constraint       |
| شاهد     | `P34.C1`                |
| وضعیت    | قرارداد تثبیت‌شده       |
| شکاف     | قید SQL و Concurrency   |

## 29. REQ-013 — ثبت اتمی نتیجه و ادامه

| فیلد     | مقدار                             |
| -------- | --------------------------------- |
| منبع     | Decisions، Product Spec، Glossary |
| مالک     | P3 و P4                           |
| جزء فعلی | `OutcomeAndContinuation`          |
| آزمون    | Atomic Domain Contract            |
| شاهد     | `P34.C1`                          |
| وضعیت    | قرارداد تثبیت‌شده                 |
| شکاف     | Transaction و Retry اجرایی        |

## 30. REQ-014 — تفکیک انتظار داخلی و خارجی

| فیلد     | مقدار                    |
| -------- | ------------------------ |
| منبع     | Product Spec و Glossary  |
| مالک     | P4                       |
| جزء فعلی | قرارداد `followup-state` |
| آزمون    | Domain Contract          |
| شاهد     | `P34.C1`                 |
| وضعیت    | قرارداد تثبیت‌شده        |
| شکاف     | Persistence و API اجرایی |

## 31. REQ-015 — تفکیک مانع و توقف موقت

| فیلد     | مقدار                    |
| -------- | ------------------------ |
| منبع     | Glossary                 |
| مالک     | P4                       |
| جزء فعلی | قرارداد `followup-state` |
| آزمون    | Transition Contract      |
| شاهد     | `P34.C1`                 |
| وضعیت    | قرارداد تثبیت‌شده        |
| شکاف     | Persistence و API اجرایی |

## 32. REQ-016 — درخواست و پاسخ تصمیم نسخه‌دار

| فیلد     | مقدار                       |
| -------- | --------------------------- |
| منبع     | Product Spec و Glossary     |
| مالک     | P4                          |
| جزء فعلی | قرارداد تصمیم نسخه‌دار      |
| آزمون    | Version Contract            |
| شاهد     | `P34.C1`                    |
| وضعیت    | قرارداد تثبیت‌شده           |
| شکاف     | Authorization و Persistence |

## 33. REQ-017 — تفکیک قصد یادآوری، موعد و تحویل

| فیلد     | مقدار                |
| -------- | -------------------- |
| منبع     | Decisions و Glossary |
| مالک     | P5                   |
| جزء فعلی | ایجاد نشده           |
| آزمون    | Integration و Retry  |
| شاهد     | ندارد                |
| وضعیت    | مصوب                 |
| شکاف     | مدل Reminder         |

## 34. REQ-018 — عدم تحویل Revision قدیمی

| فیلد     | مقدار               |
| -------- | ------------------- |
| منبع     | Glossary            |
| مالک     | P5                  |
| جزء فعلی | ایجاد نشده          |
| آزمون    | Stale Revision Test |
| شاهد     | ندارد               |
| وضعیت    | مصوب                |
| شکاف     | Revision Contract   |

## 35. REQ-019 — تفکیک Retry از تکرار

| فیلد     | مقدار                 |
| -------- | --------------------- |
| منبع     | Glossary              |
| مالک     | P5                    |
| جزء فعلی | ایجاد نشده            |
| آزمون    | Recurrence/Retry Test |
| شاهد     | ندارد                 |
| وضعیت    | مصوب                  |
| شکاف     | Policy دقیق           |

## 36. REQ-020 — Dead Letter و رسیدگی

| فیلد     | مقدار                   |
| -------- | ----------------------- |
| منبع     | Glossary و Roadmap      |
| مالک     | P5                      |
| جزء فعلی | ایجاد نشده              |
| آزمون    | Failure و Recovery Test |
| شاهد     | ندارد                   |
| وضعیت    | برنامه‌ریزی‌شده         |
| شکاف     | Queue Contract          |

## 37. REQ-021 — تفکیک Domain و Integration Event

| فیلد     | مقدار                        |
| -------- | ---------------------------- |
| منبع     | Decisions و Glossary         |
| مالک     | P3 تا P6                     |
| جزء فعلی | Structured Log پایه فقط      |
| آزمون    | Architecture و Contract Test |
| شاهد     | EVD-005 و EVD-006            |
| وضعیت    | مصوب                         |
| شکاف     | Event Contract               |

## 38. REQ-022 — Timeline کاربرمحور

| فیلد     | مقدار                      |
| -------- | -------------------------- |
| منبع     | Product Spec و Glossary    |
| مالک     | P6                         |
| جزء فعلی | ایجاد نشده                 |
| آزمون    | Ordering و Permission      |
| شاهد     | ندارد                      |
| وضعیت    | برنامه‌ریزی‌شده            |
| شکاف     | Read Model و Event Mapping |

## 39. REQ-023 — Audit افزایشی و محافظت‌شده

| فیلد     | مقدار                        |
| -------- | ---------------------------- |
| منبع     | ACS-001، Decisions، Glossary |
| مالک     | P6                           |
| جزء فعلی | ایجاد نشده                   |
| آزمون    | Immutability و Security      |
| شاهد     | ندارد                        |
| وضعیت    | مصوب                         |
| شکاف     | Audit Schema                 |

## 40. REQ-024 — Structured Log فنی

| فیلد     | مقدار                    |
| -------- | ------------------------ |
| منبع     | Glossary و Roadmap       |
| مالک     | P1.7                     |
| جزء فعلی | Worker و Scheduler پایه  |
| آزمون    | Unit و Runtime           |
| شاهد     | EVD-005 و EVD-006        |
| وضعیت    | پیاده‌سازی‌شده پایه      |
| شکاف     | Schema مشترک و Redaction |

## 41. REQ-025 — جداسازی Metadata و بایت فایل

| فیلد     | مقدار                  |
| -------- | ---------------------- |
| منبع     | Glossary               |
| مالک     | P7                     |
| جزء فعلی | ایجاد نشده             |
| آزمون    | Integration با Storage |
| شاهد     | ندارد                  |
| وضعیت    | مصوب                   |
| شکاف     | File Contract          |

## 42. REQ-026 — مجوز فایل از منبع والد

| فیلد     | مقدار                             |
| -------- | --------------------------------- |
| منبع     | Decisions، Product Spec، Glossary |
| مالک     | P7                                |
| جزء فعلی | ایجاد نشده                        |
| آزمون    | Negative Security Test            |
| شاهد     | ندارد                             |
| وضعیت    | مصوب                              |
| شکاف     | Parent Authorization              |

## 43. REQ-027 — قرنطینه و Scan پیش از Ready

| فیلد     | مقدار                        |
| -------- | ---------------------------- |
| منبع     | Glossary و Security Baseline |
| مالک     | P7                           |
| جزء فعلی | ایجاد نشده                   |
| آزمون    | Malware و State Test         |
| شاهد     | ندارد                        |
| وضعیت    | مصوب                         |
| شکاف     | Scanner و State              |

## 44. REQ-028 — حذف کنترل‌شده فایل

| فیلد     | مقدار                     |
| -------- | ------------------------- |
| منبع     | Product Spec و Glossary   |
| مالک     | P7                        |
| جزء فعلی | ایجاد نشده                |
| آزمون    | Partial Failure و Retry   |
| شاهد     | ندارد                     |
| وضعیت    | برنامه‌ریزی‌شده           |
| شکاف     | Retention و Delete Policy |

## 45. REQ-029 — Snapshot تاریخی تغییرناپذیر

| فیلد     | مقدار                             |
| -------- | --------------------------------- |
| منبع     | Decisions، Product Spec، Glossary |
| مالک     | P8                                |
| جزء فعلی | ایجاد نشده                        |
| آزمون    | Immutability Test                 |
| شاهد     | ندارد                             |
| وضعیت    | مصوب                              |
| شکاف     | Snapshot Schema                   |

## 46. REQ-030 — خروجی تاریخی از Snapshot

| فیلد     | مقدار              |
| -------- | ------------------ |
| منبع     | Glossary           |
| مالک     | P8                 |
| جزء فعلی | ایجاد نشده         |
| آزمون    | Regeneration Test  |
| شاهد     | ندارد              |
| وضعیت    | مصوب               |
| شکاف     | Generator Contract |

## 47. REQ-031 — PDF، XLSX و CSV فارسی

| فیلد     | مقدار                             |
| -------- | --------------------------------- |
| منبع     | Product Spec و Baselines          |
| مالک     | P8                                |
| جزء فعلی | ایجاد نشده                        |
| آزمون    | Format و Content Test             |
| شاهد     | ندارد                             |
| وضعیت    | برنامه‌ریزی‌شده                   |
| شکاف     | PDF Tool، Font و Canonicalization |

## 48. REQ-032 — Read Model قابل بازسازی

| فیلد     | مقدار                |
| -------- | -------------------- |
| منبع     | Decisions و Glossary |
| مالک     | P8 و P9              |
| جزء فعلی | ایجاد نشده           |
| آزمون    | Replay و Rebuild     |
| شاهد     | ندارد                |
| وضعیت    | مصوب                 |
| شکاف     | Projection Contract  |

## 49. REQ-033 — جست‌وجوی محدود به سازمان و مجوز

| فیلد     | مقدار                    |
| -------- | ------------------------ |
| منبع     | Product Spec و Glossary  |
| مالک     | P9                       |
| جزء فعلی | ایجاد نشده               |
| آزمون    | Tenant و Permission Test |
| شاهد     | ندارد                    |
| وضعیت    | مصوب                     |
| شکاف     | Search Architecture      |

## 50. REQ-034 — نرمال‌سازی فارسی

| فیلد     | مقدار                     |
| -------- | ------------------------- |
| منبع     | Glossary                  |
| مالک     | P9                        |
| جزء فعلی | ایجاد نشده                |
| آزمون    | ی/ي، ک/ك، رقم و نیم‌فاصله |
| شاهد     | ندارد                     |
| وضعیت    | برنامه‌ریزی‌شده           |
| شکاف     | قواعد نسخه‌دار            |

## 51. REQ-035 — جست‌وجوی محتوای فایل تعهد قطعی نیست

| فیلد     | مقدار                                  |
| -------- | -------------------------------------- |
| منبع     | Product Spec، Decisions، Risk Register |
| مالک     | تصمیم مستقل آینده                      |
| جزء فعلی | ایجاد نشده                             |
| آزمون    | ندارد                                  |
| شاهد     | ندارد                                  |
| وضعیت    | خارج از دامنه فعلی                     |
| شکاف     | OD-026 و بررسی امنیت                   |

## 52. TECH-001 — Modular Monolith

| فیلد       | مقدار                     |
| ---------- | ------------------------- |
| منبع       | ADRهای مصوب و Decisions   |
| مالک       | معماری                    |
| وضعیت      | مصوب                      |
| آزمون      | Architecture Test در P1.8 |
| ریسک مرتبط | RISK-013 و RISK-014       |

## 53. TECH-002 — PostgreSQL 16 منبع نهایی حقیقت

| فیلد       | مقدار                                |
| ---------- | ------------------------------------ |
| منبع       | DBS-001 و Decisions                  |
| مالک       | P1.4 و P1.5                          |
| وضعیت      | مصوب، برنامه‌ریزی‌شده برای اجرا      |
| آزمون      | Migration، Persistence و Integration |
| ریسک مرتبط | RISK-008                             |

## 54. TECH-003 — Redis 7 منبع نهایی نیست

| فیلد       | مقدار                 |
| ---------- | --------------------- |
| منبع       | Decisions             |
| مالک       | Queue و Cache         |
| وضعیت      | مصوب                  |
| آزمون      | Recovery و Queue Test |
| ریسک مرتبط | RISK-015              |

## 55. TECH-004 — S3-compatible خصوصی

| فیلد       | مقدار                            |
| ---------- | -------------------------------- |
| منبع       | Baselines و Decisions            |
| مالک       | P1.4 و P7                        |
| وضعیت      | مصوب، برنامه‌ریزی‌شده            |
| آزمون      | Bucket، Signed URL و Parent Auth |
| ریسک مرتبط | RISK-027 تا RISK-029             |

## 56. TECH-005 — Deny by Default

| فیلد       | مقدار               |
| ---------- | ------------------- |
| منبع       | ACS-001 و Decisions |
| مالک       | P2 و همه ماژول‌ها   |
| وضعیت      | مصوب                |
| آزمون      | Permission Matrix   |
| ریسک مرتبط | RISK-025 و RISK-026 |

## 57. TECH-006 — جداسازی سخت سازمانی

| فیلد       | مقدار                            |
| ---------- | -------------------------------- |
| منبع       | DBS-001، ACS-001، Product Spec   |
| مالک       | P1.5 و P2                        |
| وضعیت      | مصوب، برنامه‌ریزی‌شده            |
| آزمون      | PostgreSQL، RLS و Tenant Context |
| ریسک مرتبط | RISK-005 تا RISK-007             |

## 58. TECH-007 — Outbox تراکنشی

| فیلد       | مقدار                  |
| ---------- | ---------------------- |
| منبع       | Decisions و Glossary   |
| مالک       | P1.5                   |
| وضعیت      | برنامه‌ریزی‌شده        |
| آزمون      | Commit/Publish Failure |
| ریسک مرتبط | RISK-017               |

## 59. TECH-008 — Inbox و Idempotency

| فیلد       | مقدار                        |
| ---------- | ---------------------------- |
| منبع       | Decisions و Glossary         |
| مالک       | P1.5 و P1.6                  |
| وضعیت      | برنامه‌ریزی‌شده              |
| آزمون      | Duplicate و Concurrent Retry |
| ریسک مرتبط | RISK-016 و RISK-018          |

## 60. TECH-009 — آرشیو غیرمرجع

| فیلد       | مقدار                 |
| ---------- | --------------------- |
| منبع       | Decisions و Baselines |
| مالک       | همه مراحل             |
| وضعیت      | مصوب                  |
| آزمون      | Review مستنداتی       |
| ریسک مرتبط | RISK-041              |

## 61. TECH-010 — عدم حدس Contract

| فیلد       | مقدار                                      |
| ---------- | ------------------------------------------ |
| منبع       | Decisions، Glossary، Continuation Protocol |
| مالک       | همه مراحل                                  |
| وضعیت      | مصوب                                       |
| آزمون      | Review و Traceability                      |
| ریسک مرتبط | ریسک مستمر                                 |

## 62. P1.1 — Bootstrap مخزن

- Commit: `ffe3980`
- Tag: `Tag مستقل شناخته‌شده ندارد`
- وضعیت: پذیرفته‌شده
- شاهد: `EVD-001`

## 63. P1.2 — پایه TypeScript و کیفیت

- Commit: `00d9119`
- Tag: `stage-p1.2-typescript-linting-formatting-test-foundations`
- وضعیت: پذیرفته‌شده
- شاهد: `EVD-002`

## 64. P1.3.1 — Web Bootstrap

- Commit: `e3302824ae2f185207fddf95f60c542c92a345be`
- Tag: `stage-p1.3.1-persian-rtl-web-application-bootstrap`
- وضعیت: پذیرفته‌شده
- شاهد: `EVD-003`

## 65. P1.3.2 — API Bootstrap

- Commit: `ac905ae820b98eef16a8b251e5304dbf096398d6`
- Tag: `stage-p1.3.2-fastify-api-application-bootstrap`
- وضعیت: پذیرفته‌شده
- شاهد: `EVD-004`

## 66. P1.3.3 — Worker Bootstrap

- Commit: `f3fba3a1bde97e11d44e7d21e9702badd4514b85`
- Tag: `stage-p1.3.3-background-worker-application-bootstrap`
- وضعیت: پذیرفته‌شده
- شاهد: `EVD-005`

## 67. P1.3.4 — Scheduler Bootstrap

- Commit: `448a7fa910c299b27f8201041e61595ba7a07e3c`
- Tag: `stage-p1.3.4-scheduler-application-bootstrap`
- وضعیت: پذیرفته‌شده
- شاهد: `EVD-006`

## 68. P1.3.5 — اجرای هماهنگ

- Commit: `25e195c055e6446d16bfd0106e51510fa0457c2b`
- Tag: `stage-p1.3.5-coordinated-application-execution`
- وضعیت: پذیرفته‌شده
- شاهد: `EVD-007`

## 69. P1.3.6 — پذیرش برنامه‌ها

- Commit: `089a7066e31cd413cfce3a5246ee0038cc2e5e73`
- Tag پذیرش: `stage-p1.3.6-executable-applications-acceptance`
- Tag تکمیل مرحله مادر: `stage-p1.3-executable-applications-bootstrap-complete`
- وضعیت: پذیرفته‌شده و بسته‌شده
- شاهد: `EVD-008`
- شکاف: ندارد
- ریسک `RISK-001`: بسته‌شده

## 70. P1.4 — زیرساخت محلی

- وضعیت: بسته و پذیرفته‌شده
- خروجی پذیرفته‌شده: PostgreSQL 16، Redis 7 و MinIO روی شبکه اختصاصی و Volumeهای پایدار
- آخرین زیرمرحله بسته‌شده: `P1.4.12 — آزمون و پذیرش مرحله`
- شواهد مرحله: `EVD-009` تا `EVD-020`
- ریسک `RISK-003`: بسته‌شده
- فرض `ASM-001`: رفع‌شده
- ادعای پذیرفته‌شده: سرویس‌های داده سالم و پایدار، Bucket خصوصی و idempotent، فرمان‌های مدیریت امن، اتصال واقعی برنامه‌ها و ماندگاری داده پس از Restart همگی اثبات و در پذیرش مرحله مادر بازبینی شدند.

## 71. P1.5 — Migration و RLS

- وضعیت: بسته و پذیرفته‌شده
- آخرین زیرمرحله: `P1.5.14 — آزمون و پذیرش مرحله`
- شاهد نهایی مرحله: `EVD-024`
- Migration، History، Drift، نقش کمترین دسترسی، RLS اجباری، Tenant Context، Outbox و Inbox: تأییدشده

## 72. P1.6 — Contract و OpenAPI

- وضعیت: بسته و پذیرفته‌شده
- آخرین زیرمرحله: `P1.6.12 — آزمون و پذیرش مرحله`
- شاهد نهایی مرحله: `EVD-025`
- Error Contract، Pagination، Filter، Sort، OpenAPI، Client نوع‌دار و Contract Drift: تأییدشده

## 73. P1.7 — Observability

- وضعیت: بسته و پذیرفته‌شده
- آخرین زیرمرحله: `P1.7.12 — آزمون و پذیرش مرحله`
- شاهد نهایی مرحله: `EVD-027`
- Log، Metric، Trace، Liveness، Readiness، Health، Redaction، Dashboard و Alert پایه: تأییدشده

## 74. P1.8 — CI و معماری

- وضعیت: بسته و پذیرفته‌شده
- آخرین زیرمرحله: `P1.8.14 — آزمون و پذیرش مرحله`
- شاهد نهایی مرحله: `EVD-028`
- CI، Frozen Lockfile، Coverage، Build، Contract، Migration، Architecture و Security Gates: تأییدشده

## 75. P1.9 — Spikeهای اجباری

- وضعیت: بسته و پذیرفته‌شده
- آخرین زیرمرحله: `P1.9.8 — آزمون و پذیرش مرحله`
- شاهد نهایی مرحله: `EVD-029`
- Module Boundary، Outbox، Lease، Cache، RLS، Pool Context و Composite Constraints: تأییدشده

## 76. P1.10 — پذیرش P1

- وضعیت: بسته و پذیرفته‌شده
- آخرین زیرمرحله: `P1.10.11 — ایجاد کامیت و برچسب بسته‌شدن P1`
- شاهد نهایی: `EVD-030`
- خروجی: نصب پاک، کنترل کامل، Coverage، Build تازه، زیرساخت واقعی، Migration، RLS، Smoke، اسناد و Tag
- انتقال رسمی: `P2.1 — تثبیت قرارداد دامنه هویت و سازمان`

## 77. P2 — هویت، سازمان و مجوز

- وضعیت: برنامه‌ریزی‌شده
- خروجی هدف: Authentication، Membership، Authorization
- وابستگی یا تصمیم مهم: RLS و Policy
- ادعای پیاده‌سازی فعلی: ندارد

## 78. P3 — پرونده و مسئولیت

- وضعیت: برنامه‌ریزی‌شده
- خروجی هدف: Case، Assignment، Action
- وابستگی یا تصمیم مهم: State و Concurrency
- ادعای پیاده‌سازی فعلی: ندارد

## 79. P4 — پیگیری و تصمیم

- وضعیت: برنامه‌ریزی‌شده
- خروجی هدف: Wait، Obstacle، Pause، Decision
- وابستگی یا تصمیم مهم: Current Work و Atomic Continuation
- ادعای پیاده‌سازی فعلی: ندارد

## 80. P5 — یادآور و اعلان

- وضعیت: برنامه‌ریزی‌شده
- خروجی هدف: Reminder، Due Event، Delivery
- وابستگی یا تصمیم مهم: Revision، Retry و Provider
- ادعای پیاده‌سازی فعلی: ندارد

## 81. P6 — Timeline، Audit و همکاری

- وضعیت: برنامه‌ریزی‌شده
- خروجی هدف: Timeline، Audit، Collaboration
- وابستگی یا تصمیم مهم: Event Mapping
- ادعای پیاده‌سازی فعلی: ندارد

## 82. P7 — فایل

- وضعیت: برنامه‌ریزی‌شده
- خروجی هدف: Private File، Scan، Attachment
- وابستگی یا تصمیم مهم: Retention و Provider
- ادعای پیاده‌سازی فعلی: ندارد

## 83. P8 — گزارش

- وضعیت: برنامه‌ریزی‌شده
- خروجی هدف: Snapshot، PDF، XLSX، CSV
- وابستگی یا تصمیم مهم: Canonicalization و Font
- ادعای پیاده‌سازی فعلی: ندارد

## 84. P9 — مخاطب، پروژه و جست‌وجو

- وضعیت: برنامه‌ریزی‌شده
- خروجی هدف: Contact، Project، Search
- وابستگی یا تصمیم مهم: Normalization و Isolation
- ادعای پیاده‌سازی فعلی: ندارد

## 85. P10 — مقاوم‌سازی

- وضعیت: برنامه‌ریزی‌شده
- خروجی هدف: Security، Performance، Recovery
- وابستگی یا تصمیم مهم: SLO، RPO و RTO
- ادعای پیاده‌سازی فعلی: ندارد

## 86. P11 — استقرار

- وضعیت: برنامه‌ریزی‌شده
- خروجی هدف: Deployment و Operations
- وابستگی یا تصمیم مهم: Kubernetes فقط در صورت تصمیم
- ادعای پیاده‌سازی فعلی: ندارد

## 87. P12 — نسخه 1.0

- وضعیت: برنامه‌ریزی‌شده
- خروجی هدف: پذیرش و انتشار
- وابستگی یا تصمیم مهم: تمام معیارهای نسخه
- ادعای پیاده‌سازی فعلی: ندارد

## 88. EVD-001 — شاهد P1.1

- منبع شاهد: Commit ffe3980
- جزئیات: Monorepo و ساختار Workspace
- وضعیت اعتبار: ثبت‌شده در مرحله پذیرفته‌شده

## 89. EVD-002 — شاهد P1.2

- منبع شاهد: Commit 00d9119 و Tag رسمی
- جزئیات: TypeScript، Lint، Format و Test Foundations
- وضعیت اعتبار: ثبت‌شده در مرحله پذیرفته‌شده

## 90. EVD-003 — شاهد P1.3.1

- منبع شاهد: Commit و Tag Web
- جزئیات: ۶ آزمون ثبت‌شده و مرورگر واقعی
- وضعیت اعتبار: ثبت‌شده در مرحله پذیرفته‌شده

## 91. EVD-004 — شاهد P1.3.2

- منبع شاهد: Commit و Tag API
- جزئیات: ۸ آزمون و GET /health
- وضعیت اعتبار: ثبت‌شده در مرحله پذیرفته‌شده

## 92. EVD-005 — شاهد P1.3.3

- منبع شاهد: Commit و Tag Worker
- جزئیات: ۱۲ آزمون و Run Once
- وضعیت اعتبار: ثبت‌شده در مرحله پذیرفته‌شده

## 93. EVD-006 — شاهد P1.3.4

- منبع شاهد: Commit و Tag Scheduler
- جزئیات: ۱۷ آزمون و کاهش Drift پایه
- وضعیت اعتبار: ثبت‌شده در مرحله پذیرفته‌شده

## 94. EVD-007 — شاهد P1.3.5

- منبع شاهد: Commit و Tag اجرای هماهنگ
- جزئیات: Smoke، Cleanup و پورت آزاد
- وضعیت اعتبار: ثبت‌شده در مرحله پذیرفته‌شده

## 95. EVD-008 — شاهد P1.3.6

- منبع شاهد: اجرای نهایی پذیرش روی وضعیت نهایی مستندات
- جزئیات: `14` سند معتبر، `9` فایل آزمون، `44` آزمون موفق، Build تازه چهار برنامه با `0` Cache، Smoke هماهنگ، Cleanup، UTF-8 و Diff Check
- Commit ثبت شاهد: `089a7066e31cd413cfce3a5246ee0038cc2e5e73`
- Tag پذیرش: `stage-p1.3.6-executable-applications-acceptance`
- Tag تکمیل مرحله مادر: `stage-p1.3-executable-applications-bootstrap-complete`
- وضعیت اعتبار: معتبر و ثبت‌شده
- محدودیت پذیرش `P1.3.6`: ندارد

## 95.1. EVD-009 — شاهد P1.4.1

- منبع شاهد: ممیزی واقعی و فقط‌خواندنی Windows، WSL، Docker، پورت‌ها، دیسک و مخزن
- وضعیت اعتبار: معتبر و ثبت‌شده
- نتیجه Docker Desktop: نصب نبود
- نتیجه Docker CLI و Compose: در دسترس نبودند
- نتیجه WSL: نسخه 2 با توزیع Ubuntu در دسترس بود
- نتیجه پورت‌ها: `3000`، `3001`، `5432`، `6379`، `9000` و `9001` آزاد بودند
- نتیجه فضای دیسک: `25.68 GB` فضای آزاد
- نتیجه Docker Storage: هیچ Volume، Network یا مسیر ذخیره‌سازی موجودی یافت نشد
- نتیجه مخزن: هیچ فایل Docker، Compose یا Environment وجود نداشت
- اقدام رفع تعارض: PostgreSQL `18.4` حذف و پورت `5432` آزاد شد
- وضعیت Git در پایان ممیزی: پاک
- انتقال رسمی: `P1.4.2 — تعریف فایل‌های محیط محلی و مقادیر نمونه امن`

## 95.2. EVD-010 — شاهد P1.4.2

- منبع شاهد: `.env.example`، فایل محلی ignored، آزمون متمرکز و کنترل کامل کیفیت
- وضعیت اعتبار: معتبر و ثبت‌شده
- تعداد مقادیر نمونه غیرحساس: `9`
- فایل واقعی محلی: `.env.local` خارج از Git و مشمول قاعده `.env.*`
- Secret یا Credential واقعی ثبت‌شده: `0`
- آزمون متمرکز Environment: `4/4` موفق
- کنترل کامل کیفیت: `10` فایل آزمون و `48/48` آزمون موفق
- Commit اجرایی: `179cc504272fdae80da22bfb7abfb1ab582dc313`
- Tag اختصاصی: از قبل تعریف نشده بود و ایجاد نشد
- انتقال رسمی: `P1.4.3 — راه‌اندازی PostgreSQL 16 با نسخه ثابت`
- قید ادامه: نصب و پذیرش Docker Desktop پیش از اجرای PostgreSQL 16

## 95.3. EVD-011 — شاهد P1.4.3

- منبع شاهد: Docker Desktop، Docker Engine، Docker Compose، فایل Compose، اجرای واقعی PostgreSQL و کنترل کامل کیفیت
- وضعیت اعتبار: معتبر و ثبت‌شده
- Docker Desktop: نسخه `4.84.0`
- Docker Engine: نسخه `29.6.2`
- Docker Compose: نسخه `5.3.1`
- Docker Context: `desktop-linux`
- آزمون Container عمومی: `hello-world` موفق
- تصویر PostgreSQL: `postgres:16.14-bookworm`
- Digest معماری `linux/amd64`: `sha256:c95fd5346040eba2de3c435e14874af18f5d681fb5848d4f081dbead0878af28`
- Container فعال: `orgawork-postgres`
- Query واقعی: `160014|orgawork|orgawork`
- Endpoint محلی: `127.0.0.1:5432`
- ذخیره‌سازی: `tmpfs` و غیرپایدار تا مرحله `P1.4.6`
- Docker Volume پایدار ایجادشده: `0`
- Secret واقعی ثبت‌شده در Git: `0`
- کنترل کامل کیفیت: `10` فایل آزمون و `48/48` آزمون موفق
- Commit فنی: `b20f68df858ed4568d2e3fdb3d414491a4276445`
- Tag اختصاصی: از قبل تعریف نشده بود و ایجاد نشد
- انتقال رسمی: `P1.4.4 — راه‌اندازی Redis 7 با نسخه ثابت`

## 95.4. EVD-012 — شاهد P1.4.4

- منبع شاهد: فایل Compose، اجرای واقعی Redis، کنترل احراز هویت، کنترل Endpoint و کنترل کامل کیفیت
- وضعیت اعتبار: معتبر و ثبت‌شده
- تصویر Redis: `redis:7.4.10-bookworm`
- Digest معماری `linux/amd64`: `sha256:fe24fa2bcb59930f8863cf36a472df24efaccd8be4ee98ffe528f06d57d68dc2`
- Container فعال: `orgawork-redis`
- Compose Project مستقل: `orgawork-redis-local`
- نسخه واقعی Redis: `7.4.10`
- Endpoint محلی: `127.0.0.1:6379`
- `PING` احرازشده: `PONG`
- دسترسی بدون رمز: با `NOAUTH` رد شد
- ذخیره‌سازی: `tmpfs` و غیرپایدار تا مرحله `P1.4.6`
- Snapshot زمان‌بندی‌شده: غیرفعال
- AOF: غیرفعال
- Docker Volume پایدار ایجادشده: `0`
- Secret واقعی ثبت‌شده در Git: `0`
- هشدار Orphan پس از جداسازی Compose Project: وجود ندارد
- سلامت هم‌زمان PostgreSQL: `160014|orgawork|orgawork`
- کنترل کامل کیفیت: `10` فایل آزمون و `48/48` آزمون موفق
- Commit فنی: `4a1f7fba8d625a26c7faf19c7e20ae35264759c0`
- Tag اختصاصی: از قبل تعریف نشده بود و ایجاد نشد
- انتقال رسمی: `P1.4.5 — راه‌اندازی MinIO با نسخه ثابت`

## 95.5. EVD-013 — شاهد P1.4.5

- منبع شاهد: فایل Compose، Docker Registry، اجرای واقعی MinIO، کنترل Endpointها و پذیرش احرازشده S3
- وضعیت اعتبار: معتبر و ثبت‌شده
- تصویر MinIO: `minio/minio:RELEASE.2025-09-07T16-13-09Z`
- Digest معماری `linux/amd64`: `sha256:a1a8bd4ac40ad7881a245bab97323e18f971e4d4cba2c2007ec1bedd21cbaba2`
- Container فعال: `orgawork-minio`
- Compose Project: `orgawork-minio-local`
- Compose Service: `minio`
- نسخه واقعی Runtime: `RELEASE.2025-09-07T16-13-09Z`
- API محلی: `127.0.0.1:9000`
- Console محلی: `127.0.0.1:9001`
- مسیر سلامت API: HTTP `200`
- درخواست S3 بدون احراز هویت: HTTP `403`
- درخواست احرازشده `ListBuckets` با AWS Signature Version 4: HTTP `200`
- قرارداد XML احرازشده: `ListAllMyBucketsResult`
- Console: HTTP `200`
- Network Mode موقت: `bridge`
- HostConfig Binds: `null`
- ذخیره‌سازی موقت: `tmpfs` روی `/data`
- Persistent Mount ایجادشده: `0`
- Docker Volume پایدار ایجادشده: `0`
- Credential واقعی ثبت‌شده در Git: `0`
- سلامت PostgreSQL: `160014|orgawork|orgawork`
- سلامت Redis: `PONG`
- کنترل کامل پروژه: `10` فایل آزمون و `48/48` آزمون موفق
- Commit فنی: `c95a5a527df830cd2847df8d17b11320fe34d061`
- Tag اختصاصی: از قبل تعریف نشده بود و ایجاد نشد
- انتقال رسمی: `P1.4.6 — تعریف شبکه داخلی و Volumeهای پایدار`

## 95.6. EVD-014 — شاهد P1.4.6

- منبع شاهد: سه فایل Compose، Docker Inspect، شبکه و Volumeهای واقعی، آزمون متمرکز قرارداد زیرساخت و پذیرش Runtime
- وضعیت اعتبار: معتبر و ثبت‌شده
- Compose Project مشترک: `orgawork-data-local`
- شبکه اختصاصی: `orgawork-internal`
- Network Driver: `bridge`
- Network Internal: `false`
- Gateway پذیرفته‌شده: `172.18.0.1`
- اعضای فعال شبکه: `orgawork-postgres`، `orgawork-redis` و `orgawork-minio`
- Volume PostgreSQL: `orgawork-postgres-data` روی `/var/lib/postgresql/data`
- Volume Redis: `orgawork-redis-data` روی `/data`
- Volume MinIO: `orgawork-minio-data` روی `/data`
- Bind Mount داده: `0`
- tmpfs باقی‌مانده: `0`
- Redis Persistence: `appendonly=yes` و `appendfsync=everysec`
- انتشار PostgreSQL: `127.0.0.1:5432`
- انتشار Redis: `127.0.0.1:6379`
- انتشار MinIO API: `127.0.0.1:9000`
- انتشار MinIO Console: `127.0.0.1:9001`
- هویت PostgreSQL: `160014|orgawork|orgawork`
- پاسخ Redis: `PONG`
- سلامت MinIO: HTTP `200`
- درخواست S3 بدون احراز هویت: HTTP `403`
- درخواست احرازشده `ListBuckets`: HTTP `200` و XML معتبر `ListAllMyBucketsResult`
- DNS داخلی و اتصال TCP میان سرویس‌ها: موفق
- آزمون متمرکز قرارداد زیرساخت: `4/4` موفق
- کنترل کامل پروژه: `11` فایل آزمون و `52/52` آزمون موفق
- Commit فنی: `eb54b2bbf9f5e6668dd4f1ea1ee53159cc09ac94`
- Tag اختصاصی: از قبل تعریف نشده بود و ایجاد نشد
- آزمون رسمی ماندگاری داده پس از Restart: واگذارشده به `P1.4.11`
- انتقال رسمی: `P1.4.7 — تعریف بررسی سلامت و آمادگی سرویس‌ها`

## 95.7. EVD-015 — شاهد P1.4.7

- منبع شاهد: سه فایل Compose، Docker Inspect، گزارش اجرای Healthcheckها، آزمون متمرکز قرارداد Health و پذیرش عملیات پایه سرویس‌ها
- وضعیت اعتبار: معتبر و ثبت‌شده
- Compose Project مشترک: `orgawork-data-local`
- شبکه اختصاصی حفظ‌شده: `orgawork-internal`
- Volume PostgreSQL حفظ‌شده: `orgawork-postgres-data`
- Volume Redis حفظ‌شده: `orgawork-redis-data`
- Volume MinIO حفظ‌شده: `orgawork-minio-data`
- Healthcheck PostgreSQL: `pg_isready` با `POSTGRES_USER` و `POSTGRES_DB`
- Healthcheck Redis: `redis-cli` احرازشده با `REDIS_PASSWORD` و انتظار پاسخ `PONG`
- Healthcheck MinIO: Endpoint داخلی `/minio/health/ready`
- زمان‌بندی مشترک: `interval=10s`، `timeout=5s`، `retries=5` و `start_period=20s`
- وضعیت Runtime PostgreSQL: `healthy`
- وضعیت Runtime Redis: `healthy`
- وضعیت Runtime MinIO: `healthy`
- Failing Streak هر سه سرویس: `0`
- آخرین Exit Code هر سه Healthcheck: `0`
- عملیات PostgreSQL: `pg_isready` و `SELECT 1` موفق
- هویت PostgreSQL: `160014|orgawork|orgawork`
- عملیات Redis احرازشده: `PONG`
- عملیات Redis بدون احراز هویت: `NOAUTH Authentication required.`
- Endpoint آمادگی MinIO: HTTP `200`
- درخواست احرازشده `ListBuckets`: HTTP `200` و XML معتبر `ListAllMyBucketsResult`
- Port Bindingها، شبکه و Volumeهای پایدار: بدون تغییر
- آزمون متمرکز قرارداد Healthcheck و Readiness: `4/4` موفق
- کنترل کامل پروژه: `12` فایل آزمون و `56/56` آزمون موفق
- Commit فنی: `dc29514df161c4f10cb5ff58e2b0a06c5617ad82`
- Tag اختصاصی: از قبل تعریف نشده بود و ایجاد نشد
- آزمون رسمی ماندگاری داده پس از Restart: واگذارشده به `P1.4.11`
- انتقال رسمی: `P1.4.8 — ایجاد خودکار Bucket خصوصی فایل‌ها`

## 95.8. EVD-016 — شاهد P1.4.8

- منبع شاهد: `.env.example`، فایل Compose MinIO، Docker Inspect، گزارش اجرای Initializer، S3 API و آزمون متمرکز قرارداد Bucket
- وضعیت اعتبار: معتبر و ثبت‌شده
- نام Bucket: `orgawork-files`
- متغیر محیطی غیرحساس: `MINIO_BUCKET=orgawork-files`
- سرویس یک‌باره Compose: `minio_bucket_init`
- Container: `orgawork-minio-bucket-init`
- Image و Digest Initializer: همان Image و Digest ثابت‌شده MinIO
- شرط اجرا: `condition: service_healthy`
- شبکه Initializer: `orgawork-internal`
- Restart Policy: `no`
- ایجاد Alias احرازشده: `mc alias set`
- ایجاد idempotent Bucket: `mc mb --ignore-existing`
- تحمیل دسترسی خصوصی: `mc anonymous set private`
- کنترل وجود Bucket: `mc stat`
- اجرای اولیه Initializer: Exit Code برابر `0`
- اجرای مجدد idempotent: `2/2` موفق
- تعداد کل اجرای پذیرفته‌شده Initializer: `3`
- تعداد نهایی Bucketها: `1`
- Bucket نهایی: `orgawork-files`
- فهرست‌گیری احرازشده Bucket: HTTP `200`
- دسترسی بدون احراز هویت به Bucket: HTTP `403`
- Policy ناشناس: `private`
- Container اصلی MinIO بازسازی نشد
- شناسه Container، Image و Digest، شبکه، Volume، Port Bindingها و Healthcheck MinIO: بدون تغییر
- وضعیت PostgreSQL: `healthy`
- وضعیت Redis: `healthy`
- وضعیت MinIO: `healthy`
- آزمون متمرکز قرارداد Bucket و محیط: `9/9` موفق
- کنترل کامل پروژه: `13` فایل آزمون و `61/61` آزمون موفق
- Commit فنی: `96126445f2ec1c6ba174767f75b062b46e5663fe`
- Tag اختصاصی: از قبل تعریف نشده بود و ایجاد نشد
- آزمون اتصال واقعی برنامه‌ها به سرویس‌های محلی: واگذارشده به `P1.4.10`
- آزمون رسمی ماندگاری داده پس از Restart: واگذارشده به `P1.4.11`
- انتقال رسمی: `P1.4.9 — افزودن فرمان‌های آغاز، توقف، گزارش و پاک‌سازی زیرساخت`

## 95.9. EVD-017 — شاهد P1.4.9

- منبع شاهد: `package.json`، برنامه مرکزی فرمان‌ها، اسکریپت اجرای زیرساخت، آزمون قرارداد فرمان‌ها، Docker Inspect، Compose Runtime و S3 API
- وضعیت اعتبار: معتبر و ثبت‌شده
- Compose Project ثابت: `orgawork-data-local`
- فایل محیط محلی و ignored: `.env.local`
- فایل‌های Compose مدیریت‌شده: PostgreSQL، Redis و MinIO
- فرمان آغاز: `pnpm infra:start`
- فرمان توقف: `pnpm infra:stop`
- فرمان گزارش: `pnpm infra:report`
- فرمان پاک‌سازی: `pnpm infra:cleanup`
- برنامه مرکزی فرمان‌ها: `tools/scripts/local-infrastructure-plan.ts`
- اجرای واقعی فرمان‌ها: `tools/scripts/local-infrastructure.ts`
- آزمون قرارداد: `tools/checks/local-infrastructure-commands.test.ts`
- استفاده از `--volumes`، `-v` و `--remove-orphans`: ممنوع
- پذیرش `infra:report`: موفق و فقط‌خواندنی
- تغییر Container، شبکه، Volume یا Worktree توسط گزارش: صفر
- پذیرش `infra:stop`: موفق
- Containerهای متوقف‌شده: `4/4`
- Containerهای حذف‌شده در توقف: `0`
- شناسه Containerها پس از توقف: بدون تغییر
- شبکه و Volumeهای پایدار پس از توقف: حفظ‌شده
- پذیرش `infra:start` پس از توقف: موفق
- سرویس‌های اصلی سالم پس از آغاز: `3/3`
- شناسه Containerهای اصلی پس از آغاز: بدون تغییر
- Initializer پس از آغاز: Exit Code برابر `0` و Restart Policy برابر `no`
- پذیرش `infra:cleanup`: چهار Container و شبکه Compose حذف شدند
- Volumeهای پایدار پس از پاک‌سازی: `3/3` حفظ‌شده
- هویت Volumeهای پایدار پس از پاک‌سازی: بدون تغییر
- اصلاح خطای گزارش پس از پاک‌سازی: تطبیق case-insensitive پیام `no such object`
- اجرای مجدد پاک‌سازی در وضعیت ازپیش‌پاک‌شده: موفق
- پذیرش idempotent پاک‌سازی: موفق
- اجرای تازه `infra:start` پس از پاک‌سازی کامل: موفق
- Containerهای ایجادشده پس از آغاز تازه: `4/4`
- شبکه `orgawork-internal`: ایجادشده با Label صحیح پروژه
- PostgreSQL، Redis و MinIO پس از آغاز تازه: `healthy`
- Initializer پس از آغاز تازه: Exit Code برابر `0`
- Bucket نهایی: دقیقاً یک Bucket با نام `orgawork-files`
- دسترسی احرازشده Bucket: HTTP `200`
- دسترسی بدون احراز هویت Bucket: HTTP `403`
- Policy Bucket: `private`
- آزمون متمرکز قرارداد فرمان‌ها: `8/8` موفق
- کنترل کامل پروژه: `14` فایل آزمون و `69/69` آزمون موفق
- Commit فنی: `061bbe20b0acda86d1aca2ac786cb076c98e5690`
- Tag اختصاصی: از قبل تعریف نشده بود و ایجاد نشد
- آزمون اتصال واقعی برنامه‌ها به سرویس‌های محلی: واگذارشده به `P1.4.10`
- آزمون رسمی ماندگاری محتوای داده پس از Restart: واگذارشده به `P1.4.11`
- انتقال رسمی: `P1.4.10 — آزمون اتصال واقعی برنامه‌ها به سرویس‌های محلی`

## 95.10. EVD-018 — شاهد P1.4.10

- منبع شاهد: بسته‌های مشترک اتصال، مسیرهای API و Web، رخدادهای Worker و Scheduler، آزمون قرارداد، پذیرش واقعی سرویس‌ها و Commit فنی
- وضعیت اعتبار: معتبر و ثبت‌شده
- بسته تنظیمات: `@workspace/configuration`
- بسته PostgreSQL: `@workspace/database` با `pg@8.22.0` و `@types/pg@8.20.0`
- بسته Redis: `@workspace/queue` با `redis@6.1.0`
- بسته MinIO: `@workspace/storage` با `@aws-sdk/client-s3@3.1090.0`
- مسیر API: `GET /connectivity`
- مسیر Web: `GET /api/connectivity`
- رخداد Worker و Scheduler: `connectivity-verified`
- Probe PostgreSQL: `SELECT 1`
- Probe Redis: `PING`
- Probe MinIO: `HeadBucket` برای `orgawork-files`
- پذیرش واقعی چهار برنامه و سه سرویس: موفق
- عملیات تغییردهنده در پذیرش: صفر
- Secret چاپ‌شده یا ثبت‌شده: صفر
- آزمون قرارداد: `6/6` موفق
- کنترل کامل پروژه: `20` فایل آزمون و `86/86` آزمون موفق
- ساخت برنامه‌ها و وابستگی‌ها: `8/8` Task موفق
- Commit فنی: `707f3f855ccd3fe618d4fcf6d95daa2022143680`
- Tag اختصاصی: از قبل تعریف نشده بود و ایجاد نشد
- آزمون رسمی ماندگاری داده: واگذارشده به `P1.4.11`
- انتقال رسمی: `P1.4.11 — آزمون پایداری داده پس از توقف و آغاز مجدد`

## 95.11. EVD-019 — شاهد P1.4.11

- منبع شاهد: برنامه پذیرش ماندگاری، آزمون‌های قرارداد و Regression، گزارش واقعی Docker و Commit فنی
- وضعیت اعتبار: معتبر و ثبت‌شده
- فرمان پذیرش: `pnpm infra:persistence`
- اثبات محتوای پیش از توقف: `3/3` موفق
- اثبات همان محتوا پس از آغاز مجدد: `3/3` موفق
- هویت Volumeهای پایدار: `3/3` حفظ‌شده
- Policy Bucket `orgawork-files`: خصوصی
- استفاده از `infra:cleanup` یا حذف Volume: انجام نشد
- پاک‌سازی داده و ساختار موقت پذیرش: تأییدشده
- آزمون متمرکز قرارداد و Regression: `8/8` موفق
- کنترل کامل پروژه: `21` فایل آزمون و `94/94` آزمون موفق
- ساخت برنامه‌ها و وابستگی‌ها: `8/8` Task موفق
- Commit فنی: `4d19216c8316d108e4ebf797b52abd132e3526c2`
- انتقال رسمی: `P1.4.12 — آزمون و پذیرش مرحله`

## 95.12. EVD-020 — شاهد P1.4.12

- منبع شاهد: Roadmap، ماتریس ردیابی، گزارش Runtime زیرساخت، ممیزی داده‌های موقت، کنترل کامل پروژه و Build برنامه‌ها
- وضعیت اعتبار: معتبر و ثبت‌شده
- دامنه: پذیرش نهایی مرحله مادر `P1.4` بدون افزودن قابلیت اجرایی جدید
- زیرمرحله‌های بسته‌شده: `P1.4.1` تا `P1.4.11`
- شواهد تطبیق‌داده‌شده: `EVD-009` تا `EVD-019`
- سلامت PostgreSQL، Redis و MinIO: `3/3`
- شبکه اختصاصی: موجود
- Volumeهای پایدار: `3/3` موجود
- Policy Bucket `orgawork-files`: خصوصی
- داده‌های موقت پذیرش در PostgreSQL، Redis و MinIO: صفر `3/3`
- کنترل کامل پروژه: `21` فایل آزمون و `94/94` آزمون موفق
- ساخت برنامه‌ها و وابستگی‌ها: `8/8` Task موفق
- Worktree: پاک
- Tag اختصاصی: از قبل تعریف نشده بود و ایجاد نشد
- نتیجه مرحله مادر `P1.4`: بسته و پذیرفته‌شده
- انتقال رسمی: `P1.5.1 — تکمیل بسته مشترک دسترسی به پایگاه داده`

## 95.13. EVD-021 — شاهد P1.5.1

- منبع شاهد: بسته `@workspace/database`، آزمون‌های متمرکز، پذیرش واقعی PostgreSQL، کنترل کامل پروژه، Build برنامه‌ها و Commit فنی
- وضعیت اعتبار: معتبر و ثبت‌شده
- Pool مشترک با محدودیت اتصال و Timeoutهای کنترل‌شده: پیاده‌سازی‌شده
- Query پارامتری: پیاده‌سازی و در Runtime واقعی تأییدشده
- Transaction با `BEGIN`، `COMMIT`، `ROLLBACK` و آزادسازی Client: پیاده‌سازی و تأییدشده
- خطاهای پایدار و بدون افشای Credential: تأییدشده
- بستن idempotent Pool: تأییدشده
- آزمون متمرکز بسته: `8/8` موفق
- کنترل کامل پروژه: `22` فایل آزمون و `102/102` آزمون موفق
- ساخت برنامه‌ها و وابستگی‌ها: `8/8` Task موفق
- Commit فنی: `ccf4f811b85a0c8a6d94830acdb413ec0cb3df94`
- پیام Commit: `P1.5.1: complete shared PostgreSQL access package`
- قابلیت Migration نسخه‌دار: عمداً به `P1.5.2` واگذار شد
- Tag اختصاصی: از قبل تعریف نشده بود و ایجاد نشد
- انتقال رسمی: `P1.5.2 — ایجاد اجراکننده مهاجرت‌های نسخه‌دار`

## 95.14. EVD-022 — شاهد P1.5.2

- منبع شاهد: اجراکننده Migration نسخه‌دار، آزمون‌های متمرکز، پذیرش واقعی PostgreSQL، کنترل کامل پروژه، Build برنامه‌ها و Commit فنی
- وضعیت اعتبار: معتبر و ثبت‌شده
- کشف فایل‌های SQL نسخه‌دار: پیاده‌سازی و تأییدشده
- اعتبارسنجی نام فایل، نسخه یکتا و SQL غیرخالی: تأییدشده
- ترتیب صعودی قطعی: پیاده‌سازی و در Runtime واقعی تأییدشده
- فیلتر نسخه‌های اعمال‌شده از طریق `appliedVersions`: پیاده‌سازی و تأییدشده
- اجرای اتمیک Migrationهای در انتظار: پیاده‌سازی و در Runtime واقعی تأییدشده
- عدم آغاز Transaction در نبود Migration در انتظار: تأییدشده
- خطاهای پایدار و بدون افشای SQL یا Credential: تأییدشده
- آزمون متمرکز اجراکننده: `8/8` موفق
- کنترل کامل پروژه: `23` فایل آزمون و `110/110` آزمون موفق
- ساخت برنامه‌ها و وابستگی‌ها: `8/8` Task موفق
- Commit فنی: `c5fc997944ebade88f11cd42a2203b64e09e8da7`
- پیام Commit: `P1.5.2: add versioned migration runner`
- ثبت پایدار تاریخچه و اثرانگشت: عمداً به `P1.5.3` واگذار شد
- Tag اختصاصی: از قبل تعریف نشده بود و ایجاد نشد
- انتقال رسمی: `P1.5.3 — ثبت تاریخچه، ترتیب و اثرانگشت مهاجرت‌ها`

## 95.15. EVD-023 — شاهد P1.5.3

- منبع شاهد: Migration رسمی تاریخچه، بسته `@workspace/database`، آزمون‌های متمرکز، پذیرش واقعی PostgreSQL، کنترل کامل پروژه، Build برنامه‌ها و Commit فنی
- وضعیت اعتبار: معتبر و ثبت‌شده
- Migration رسمی `0001_create-migration-history.sql`: ایجاد و تأییدشده
- جدول idempotent `public.orgawork_migration_history`: ایجاد و در Runtime واقعی تأییدشده
- ثبت نسخه، نام فایل، ترتیب و زمان اعمال: پیاده‌سازی و تأییدشده
- اثرانگشت lowercase SHA-256: پیاده‌سازی و تأییدشده
- کنترل Prefix تاریخچه: پیاده‌سازی و تأییدشده
- توقف پیش از SQL در اختلاف نسخه، ترتیب یا اثرانگشت: تأییدشده
- اجرای Migration و ثبت تاریخچه در یک Transaction: تأییدشده
- اجرای دوباره و Skip Migrationهای ثبت‌شده: تأییدشده
- خطاهای پایدار و بدون افشای SQL یا Credential: تأییدشده
- پاک‌سازی Artifact پذیرش واقعی: تأییدشده
- آزمون متمرکز تاریخچه: `8/8` موفق
- کنترل کامل پروژه: `24` فایل آزمون و `118/118` آزمون موفق
- ساخت برنامه‌ها و وابستگی‌ها: `8/8` Task موفق
- Commit فنی: `9f41511f8fa8cc06bfb0a8272a6cdd5b882d9dd3`
- پیام Commit: `P1.5.3: add persistent migration history`
- Tag اختصاصی: از قبل تعریف نشده بود و ایجاد نشد
- انتقال رسمی: `P1.5.4 — ایجاد نقش‌های پایگاه داده با کمترین سطح دسترسی`

## 95.16. EVD-024 — شاهد بسته‌شدن P1.5

- وضعیت: معتبر و ثبت‌شده
- دامنه: `P1.5.4` تا `P1.5.14` و اختتام مرحله مادر `P1.5`
- نقش‌های کمترین دسترسی و بدون Login: تأییدشده
- NOBYPASSRLS برای نقش‌های عادی: تأییدشده
- Tenant Context محدود به Transaction: تأییدشده
- RLS فعال و اجباری: تأییدشده
- Outbox، Inbox، Heartbeat و زمان‌های پایان امن: تأییدشده
- بررسی Drift تعداد، ترتیب، نام و SHA-256 Migrationها: تأییدشده
- اجرای دوباره بدون اعمال مجدد: تأییدشده
- جلوگیری واقعی از دسترسی بین‌سازمانی: تأییدشده
- منع دسترسی بدون Tenant Context: تأییدشده
- کنترل کامل پروژه: موفق
- Build نهایی: موفق
- Commit P1.5.4: `dbbf0fb902a3016522e0fa92e4364968810b5843`
- Commit Batch A: `18df7c38bf58afd75c0fa7c422f6363f6b1ca412`
- Commit فنی نهایی: `0dbdf01003df2d1351991074c4e98d01f5c26bd8`
- Tag اختصاصی: ایجاد نشد
- انتقال رسمی: `P1.6.1 — تکمیل بسته قراردادهای مشترک`

## 95.17. EVD-025 — شاهد بسته‌شدن P1.6

- وضعیت: معتبر و ثبت‌شده
- دامنه: `P1.6.1` تا `P1.6.12` و اختتام مرحله مادر `P1.6`
- بسته `@workspace/contracts`: تأییدشده
- شناسه‌ها، زمان UTC و انواع پایه: تأییدشده
- پاسخ موفق و خطاهای پایدار فارسی: تأییدشده
- Pagination، Sort و Filter: تأییدشده
- Session و Organization Context: تأییدشده
- OpenAPI 3.1 و مسیرهای Health و Readiness: تأییدشده
- مشتری نوع‌دار API: تأییدشده
- SHA-256 Contract Drift: تأییدشده
- سازگاری OpenAPI، Server و Client: تأییدشده
- کنترل کامل پروژه و Build: موفق
- Commit فنی: `eab8f0c1df4e3ff3fd1feba34cb4be7a9313b887`
- Tag اختصاصی: ایجاد نشد
- انتقال رسمی: `P1.7.1 — تعریف ثبت رخداد ساختاریافته مشترک`

## 95.18. EVD-026 — شاهد بسته نخست P1.7

- وضعیت: معتبر و ثبت‌شده
- دامنه: `P1.7.1` تا `P1.7.4`
- Structured Log مشترک: تأییدشده
- Request ID و Correlation ID: تأییدشده
- Redaction مرکزی Secret و Credential: تأییدشده
- W3C Trace Context و Trace Parent: تأییدشده
- یکپارچه‌سازی API، Worker و Scheduler: تأییدشده
- آزمون مثبت، منفی و Async Context: موفق
- کنترل کامل پروژه و Build مستقیم: موفق
- Commit فنی: `5bb17a094ba2fa3dfc25fed565e404f676c403f7`
- Tag اختصاصی: ایجاد نشد
- انتقال رسمی: `P1.7.5 — ایجاد سنجه‌های پایه رابط برنامه‌نویسی`

## 95.19. EVD-027 — شاهد پذیرش نهایی P1.7

- وضعیت: معتبر و ثبت‌شده
- دامنه: `P1.7.5` تا `P1.7.12` و بستن والد `P1.7`
- API، Database، Transaction و Queue Metrics: تأییدشده
- Liveness، Readiness و Health: تأییدشده
- Worker و Scheduler Heartbeat: تأییدشده
- Dashboard و Alert پایه: تأییدشده
- Failure و Recovery وابستگی: تأییدشده
- کنترل کامل پروژه و Build مستقیم: موفق
- Commit فنی: `c13015d62ed2d3d9141f1f9962428fea343dd33d`
- Tag اختصاصی: ایجاد نشد
- انتقال رسمی: `P1.8.1 — ایجاد گردش کار یکپارچه‌سازی مداوم`

## 95.20. EVD-028 — شاهد پذیرش نهایی P1.8

- وضعیت: معتبر و ثبت‌شده
- دامنه: `P1.8.1` تا `P1.8.14` و بستن والد `P1.8`
- CI و Frozen Lockfile: تأییدشده
- Format، Lint، TypeScript، Test و Coverage Gate: تأییدشده
- Build مستقیم چهار برنامه: تأییدشده
- Contract، OpenAPI، Migration و Drift Gate: تأییدشده
- Architecture، Cycle و Dependency Policy: تأییدشده
- Secret، UTF-8 و Dependency Pinning: تأییدشده
- JUnit، Coverage، CI Summary و Artifact: تأییدشده
- Branch Protection baseline: ثبت‌شده؛ Remote تغییر نکرد
- کنترل کامل پروژه و Build مستقیم: موفق
- Commit فنی: `a25f76df004f418119159706540379d689e12d91`
- Tag اختصاصی: ایجاد نشد
- انتقال رسمی: `P1.9.1 — بررسی عملی مرز ماژول‌ها و جلوگیری از وابستگی چرخه‌ای`

## 95.21. EVD-029 — شاهد پذیرش نهایی P1.9

- وضعیت: معتبر و ثبت‌شده
- دامنه: `P1.9.1` تا `P1.9.8` و بستن والد `P1.9`
- مرز ماژول و Cycle: تأییدشده
- Outbox، تحویل تکراری و Lease Recovery: تأییدشده
- نشست، سازمان جاری و Cache: تأییدشده در سطح Spike
- RLS، Pool و Tenant Context واقعی: تأییدشده
- Unique و روابط مرکب PostgreSQL: تأییدشده
- تصمیم، محدودیت و بدهی فنی: ثبت‌شده
- آزمون‌های بازگشتی و کنترل کامل پروژه: موفق
- Commit فنی: `b4d3ff0a853fe2b8d4e52bba05862bf0fb46b228`
- Tag اختصاصی: ایجاد نشد
- انتقال رسمی: `P1.10.1 — ممیزی همه مراحل P1.1 تا P1.9`

## 95.22. EVD-030 — شاهد پذیرش نهایی بنیاد P1

- وضعیت: معتبر و ثبت‌شده
- دامنه: `P1.1` تا `P1.10` و بستن والد `P1`
- ممیزی Commitها، Tagها و شواهد `EVD-001` تا `EVD-029`: موفق
- نصب پاک وابستگی‌ها با `pnpm --frozen-lockfile`: موفق
- Lockfile SHA-256: `201fe4e93ed71aed895d788bc030aecd0e399a102b9e4b7bf8ea7589a69b381e`
- Format، Lint، Typecheck، Test و Coverage: موفق
- Test Suiteها: `49`
- Test Caseها: `247`
- Coverage خطوط: `65.23%`
- Build تازه چهار برنامه بدون خروجی قبلی: موفق
- PostgreSQL، Redis، MinIO و Bucket خصوصی: سالم
- Migration واقعی و Rerun: موفق
- RLS، Tenant Context، Outbox، Inbox و Lease Recovery واقعی: موفق
- Smoke هماهنگ Web، API، Worker و Scheduler: موفق
- ممیزی اسناد، UTF-8، Secret، Dependency و Roadmap: موفق
- Commit فنی: `728993f240296a8017cb3fb883c3c7802fcba575`
- Tag پایان P1: `stage-p1.10-foundation-acceptance-complete`
- انتقال رسمی: `P2.1 — تثبیت قرارداد دامنه هویت و سازمان`

## 96. ماتریس آزمون زبان و زمان

| نیاز                       | Unit                 | Integration      | Browser | پذیرش             |
| -------------------------- | -------------------- | ---------------- | ------- | ----------------- |
| `REQ-001` فارسی            | پایه                 | آینده دامنه      | پایه    | P1.3.6 و مراحل UI |
| `REQ-002` RTL              | پایه                 | آینده دامنه      | پایه    | P1.3.6 و مراحل UI |
| `REQ-003` نبود انگلیسی خام | محدود                | آینده            | پایه    | تمام مراحل UI     |
| `REQ-004` شمسی             | پایه                 | آینده            | پایه    | P1.3.6 و دامنه    |
| `REQ-005` UTC              | API/Worker/Scheduler | آینده DB/Message | نامرتبط | P1.3.6 و بعد      |

## 97. ماتریس آزمون امنیت و Tenant

| نیاز                        | Unit  | PostgreSQL واقعی | آزمون منفی | پذیرش     |
| --------------------------- | ----- | ---------------- | ---------- | --------- |
| `TECH-005` Deny             | آینده | متناسب           | الزامی     | P2        |
| `TECH-006` Tenant Isolation | آینده | الزامی           | الزامی     | P1.5 و P2 |
| `REQ-026` File Parent Auth  | آینده | متناسب           | الزامی     | P7        |
| `REQ-033` Search Isolation  | آینده | متناسب           | الزامی     | P9        |
| `REQ-029` Report Snapshot   | آینده | الزامی           | الزامی     | P8        |

## 98. ماتریس آزمون دامنه

| نیاز                     | Unit   | Integration | Concurrency | پذیرش |
| ------------------------ | ------ | ----------- | ----------- | ----- |
| `REQ-009` پرونده         | آینده  | آینده       | متناسب      | P3    |
| `REQ-011` مسئول اصلی     | آینده  | الزامی      | الزامی      | P3    |
| `REQ-012` کار جاری       | آینده  | الزامی      | الزامی      | P3/P4 |
| `REQ-013` نتیجه و ادامه  | الزامی | الزامی      | الزامی      | P3/P4 |
| `REQ-016` تصمیم نسخه‌دار | آینده  | آینده       | متناسب      | P4    |

## 99. ماتریس آزمون یادآور

| نیاز                       | Unit   | Integration | Duplicate/Retry | پذیرش |
| -------------------------- | ------ | ----------- | --------------- | ----- |
| `REQ-017` تفکیک سه‌لایه    | آینده  | الزامی      | الزامی          | P5    |
| `REQ-018` Revision قدیمی   | الزامی | الزامی      | الزامی          | P5    |
| `REQ-019` Retry/Recurrence | الزامی | آینده       | الزامی          | P5    |
| `REQ-020` Dead Letter      | آینده  | الزامی      | الزامی          | P5    |

## 100. ماتریس آزمون فایل و گزارش

| نیاز                           | Integration واقعی | Security | Immutability | پذیرش |
| ------------------------------ | ----------------- | -------- | ------------ | ----- |
| `REQ-025` Metadata/Bytes       | MinIO             | متناسب   | نامرتبط      | P7    |
| `REQ-026` Parent Auth          | MinIO/API         | الزامی   | نامرتبط      | P7    |
| `REQ-027` Scan/Quarantine      | Adapter واقعی     | الزامی   | نامرتبط      | P7    |
| `REQ-029` Snapshot             | PostgreSQL        | الزامی   | الزامی       | P8    |
| `REQ-030` Output from Snapshot | Generator         | الزامی   | الزامی       | P8    |

## 101. GAP-001 — Commit و Tag P1.3.6

- وضعیت: بسته‌شده
- مرحله مالک: `P1.3.6`
- Commit شاهد: `089a7066e31cd413cfce3a5246ee0038cc2e5e73`
- Tag پذیرش: `stage-p1.3.6-executable-applications-acceptance`
- Tag تکمیل مرحله مادر: `stage-p1.3-executable-applications-bootstrap-complete`
- فضای کاری پس از ثبت: پاک
- انتقال رسمی: `P1.4.1 — ممیزی Docker Desktop و Docker Compose`

## 102. GAP-002 — ابزار Migration

- وضعیت: باز
- مرحله مالک: P1.5
- شاهد لازم برای بسته‌شدن: تصمیم رسمی و Spike متناسب
- پیاده‌سازی حدسی پیش از مرحله مالک: ممنوع

## 103. GAP-003 — Tenant Context و RLS

- وضعیت: باز
- مرحله مالک: P1.5
- شاهد لازم برای بسته‌شدن: آزمون PostgreSQL واقعی
- پیاده‌سازی حدسی پیش از مرحله مالک: ممنوع

## 104. GAP-004 — OpenAPI و Error Contract

- وضعیت: باز
- مرحله مالک: P1.6
- شاهد لازم برای بسته‌شدن: Contract Test و Drift Check
- پیاده‌سازی حدسی پیش از مرحله مالک: ممنوع

## 105. GAP-005 — CI و Architecture Check

- وضعیت: باز
- مرحله مالک: P1.8
- شاهد لازم برای بسته‌شدن: Pipeline و قواعد وابستگی
- پیاده‌سازی حدسی پیش از مرحله مالک: ممنوع

## 106. GAP-006 — Stateهای دامنه

- وضعیت: باز
- مرحله مالک: P3 و P4
- شاهد لازم برای بسته‌شدن: Contract، Transition و Migration
- پیاده‌سازی حدسی پیش از مرحله مالک: ممنوع

## 107. GAP-007 — Providerهای اعلان و فایل

- وضعیت: باز
- مرحله مالک: P5 و P7
- شاهد لازم برای بسته‌شدن: Spike، Contract و Integration
- پیاده‌سازی حدسی پیش از مرحله مالک: ممنوع

## 108. GAP-008 — PDF فارسی و Canonicalization

- وضعیت: باز
- مرحله مالک: P1.9 و P8
- شاهد لازم برای بسته‌شدن: فایل واقعی و Determinism
- پیاده‌سازی حدسی پیش از مرحله مالک: ممنوع

## 109. GAP-009 — مدل Search

- وضعیت: باز
- مرحله مالک: P9
- شاهد لازم برای بسته‌شدن: Normalization، Permission و Rebuild
- پیاده‌سازی حدسی پیش از مرحله مالک: ممنوع

## 110. GAP-010 — SLO، RPO و RTO

- وضعیت: باز
- مرحله مالک: P10 و P11
- شاهد لازم برای بسته‌شدن: بار واقعی و Restore Drill
- پیاده‌سازی حدسی پیش از مرحله مالک: ممنوع

## 111. ثبت ریسک‌های مسدودکننده P1.3.6

| موضوع      | اثر                  | اقدام                     |
| ---------- | -------------------- | ------------------------- |
| `RISK-001` | مرحله رسمی بسته نیست | تکمیل اسناد و پذیرش نهایی |
| `RISK-002` | آغاز زودهنگام P1.4   | ممنوعیت شروع              |
| `RISK-040` | عقب‌ماندن مستندات    | ممیزی متقابل              |
| `RISK-042` | خرابی UTF-8          | ممیزی نهایی               |
| `RISK-045` | Build Cache          | Build تازه                |
| `RISK-046` | Cleanup ناقص         | Smoke و Port Check        |
| `DEBT-001` | اسناد مفقود          | تکمیل دو سند باقی‌مانده   |

## 112. ثبت ریسک‌های داده و قرارداد

| ریسک                     | ردیف مرتبط       |
| ------------------------ | ---------------- |
| `RISK-005` تا `RISK-007` | `TECH-006`       |
| `RISK-008`               | `TECH-002`       |
| `RISK-009`               | Contractهای P1.6 |
| `RISK-010`               | `REQ-007`        |
| `RISK-016` و `RISK-018`  | `TECH-008`       |
| `RISK-017`               | `TECH-007`       |

## 113. ثبت ریسک‌های دامنه

| ریسک       | ردیف مرتبط |
| ---------- | ---------- |
| `RISK-022` | `REQ-011`  |
| `RISK-023` | `REQ-013`  |
| `RISK-024` | `REQ-012`  |
| `RISK-025` | `REQ-010`  |
| `RISK-026` | `TECH-005` |

## 114. ثبت ریسک‌های فایل و گزارش

| ریسک       | ردیف مرتبط |
| ---------- | ---------- |
| `RISK-027` | `REQ-026`  |
| `RISK-028` | `REQ-027`  |
| `RISK-029` | `REQ-028`  |
| `RISK-030` | `REQ-029`  |
| `RISK-031` | `REQ-030`  |
| `RISK-032` | `REQ-031`  |
| `RISK-033` | `REQ-032`  |
| `RISK-034` | `REQ-033`  |
| `RISK-035` | `REQ-034`  |
| `RISK-036` | `REQ-035`  |

## 115. هنگام افزودن نیاز

1. شناسه پایدار ایجاد شود.
2. منبع رسمی ثبت شود.
3. مالک مرحله مشخص شود.
4. تصمیم مرتبط ثبت شود.
5. معیار آزمون تعریف شود.
6. وضعیت اولیه ثبت شود.
7. ریسک و شکاف مرتبط درج شود.

## 116. هنگام افزودن کد

کد جدید باید به نیاز، تصمیم، Task Roadmap، اصلاح نقص، پرداخت بدهی یا کاهش ریسک متصل شود.

## 117. هنگام افزودن آزمون

آزمون باید مشخص کند کدام نیاز را پوشش می‌دهد، مثبت یا منفی است، سطح آن چیست و چه ناوردایی را اثبات می‌کند.

## 118. هنگام Commit و Tag

- Journal و ماتریس در صورت تغییر دامنه یا شاهد به‌روزرسانی می‌شوند.
- Commit باید به Stage و خروجی قابل ردیابی اشاره کند.
- Tag باید به Commit پذیرفته‌شده Resolve شود.

## 119. هنگام بسته‌شدن تصمیم باز

- نتیجه در `DECISIONS.md` ثبت می‌شود.
- ردیف‌های وابسته به تصمیم نهایی متصل می‌شوند.
- گزینه‌های ردشده حفظ می‌شوند.
- اثر Migration و Test ثبت می‌شود.

## 120. هنگام منسوخ‌شدن نیاز

نیاز حذف نمی‌شود؛ وضعیت `منسوخ` می‌گیرد و تصمیم جایگزین، اثر داده، Migration و آزمون ثبت می‌شوند.

## 121. کنترل شناسه

هیچ شناسه‌ای نباید برای دو مفهوم مستقل استفاده شود.

## 122. کنترل منبع و مالک

هر ردیف نیاز یا قاعده باید حداقل یک منبع رسمی و یک مرحله یا نقش مالک داشته باشد.

## 123. کنترل آزمون و شاهد

نیاز پذیرفته‌شده بدون آزمون یا شاهد متناسب مجاز نیست.

## 124. کنترل وضعیت

وضعیت ردیف باید با Status، Journal، Commit، Tag و واقعیت اجرایی سازگار باشد.

## 125. کنترل UTF-8

فایل باید UTF-8 بدون BOM، بدون نویسه جایگزین Unicode، بدون Mojibake، بدون فاصله انتهای خط و دارای خط پایانی استاندارد باشد.

## 126. پوشش فعلی P0

خط‌مبناهای Product، ADR، Domain، Database، Access، UX و Development Readiness ثبت شده‌اند.

## 127. پوشش فعلی P1.1 تا P1.3.5

Commit و Tagهای شناخته‌شده ثبت شده‌اند. برای P1.1 Tag مستقل شناخته‌شده‌ای ثبت نشده است.

## 128. پوشش فعلی P1.3.6

شواهد فنی، Commit پذیرش و هر دو Tag رسمی ثبت شده‌اند و شکاف پذیرش `P1.3.6` بسته است.

## 129. پوشش مرحله جاری و مراحل آینده

`P1.4` در حال اجرا است؛ `P1.4.1` با شاهد `EVD-009` بسته شده و `P1.4.2` جاری است.

`P1.5` تا `P12` در سطح نیاز، مالک و معیار هدف ردیابی شده‌اند، نه در سطح ادعای پیاده‌سازی.

## 130. محدودیت نسخه نخست ماتریس

این نسخه هنوز مسیر دقیق تمام فایل‌های کد و نام همه Test Caseهای آینده را ثبت نمی‌کند، زیرا ماژول‌های دامنه هنوز ایجاد نشده‌اند. این جزئیات باید هم‌زمان با هر مرحله افزوده شوند.

## 131. معیار پذیرش این سند

این سند معتبر است اگر:

- نیازها را به منبع و مرحله متصل کند؛
- Commit و Tagهای شناخته‌شده را درست ثبت کند؛
- وضعیت `P1.3.6` و `P1.4.1` را مطابق Commit، Tag و شواهد واقعی ثبت کند؛
- ریسک‌ها و شکاف‌ها را به نیازها متصل کند؛
- آرشیو را غیرمرجع بداند؛
- تصمیم‌های باز را مقداردهی حدسی نکند؛
- زبان، زمان، Tenant، RLS، دامنه، فایل، گزارش و جست‌وجو را پوشش دهد؛
- با Status، Roadmap، Decisions، Glossary، Test Policy و Risk Register سازگار باشد.

## 132. ممنوعیت ردیابی صوری

ردیابی صوری شامل این موارد است:

- شناسه بدون منبع؛
- آزمون بدون ارتباط با نیاز؛
- Commit بدون Stage؛
- Stage بدون معیار پذیرش؛
- وضعیت پذیرفته‌شده بدون شاهد؛
- آرشیو به‌عنوان تنها منبع حقیقت.

## 133. اصل نهایی

هر نیاز مهم باید از تصمیم تا کد و از کد تا آزمون قابل دنبال‌کردن باشد.

هر آزمون مهم باید مشخص کند کدام نیاز یا ناوردایی را اثبات می‌کند.

هر شاهد پذیرش باید به Stage، Commit و وضعیت واقعی متصل باشد.

اگر نتوان توضیح داد یک تغییر چرا وجود دارد، چه چیزی آن را مجاز کرده و چگونه اثبات شده است، ردیابی پروژه کامل نیست.

## EVD-031 — شاهد قرارداد هویت و سازمان P2.1

- مرحله: `P2.1`
- شاهد: قرارداد هویت و سازمان و ممیزی بسته‌شده آن
- وضعیت: بسته

## EVD-032 — شاهد مدل دامنه هویت و سازمان P2.2

- مرحله: `P2.2`
- شاهد: مدل‌های کاربر، سازمان، عضویت و تیم و ممیزی بسته‌شده آن‌ها
- وضعیت: بسته

## EVD-033 — شاهد Migration و جداسازی سازمانی P2.3

- مرحله: `P2.3`
- شاهد: Migration نسخه 4، RLS اجباری و پذیرش PostgreSQL واقعی
- وضعیت: بسته

## EVD-041 — شاهد پذیرش نهایی P2

| نیاز                          | تصمیم                    | پیاده‌سازی                                      | آزمون                                | وضعیت |
| ----------------------------- | ------------------------ | ----------------------------------------------- | ------------------------------------ | ----- |
| امنیت گذرواژه و نشست          | DEC-P21-003 و DEC-P2-001 | `packages/security` و `modules/authentication`  | آزمون هدف و PostgreSQL واقعی         | بسته  |
| سازمان جاری و RLS             | DEC-P2-001               | `modules/organization-context` و Migration 0006 | آزمون تغییر سازمان و جداسازی         | بسته  |
| مجوز و Explicit Deny          | DEC-P21-005 و DEC-P2-001 | `modules/authorization` و Migration 0007        | آزمون منفی و اولویت منع              | بسته  |
| فهرست سازمان‌های فعال تحت RLS | DEC-P2-001               | Migration 0008                                  | پذیرش واقعی PostgreSQL و آزمون سیاست | بسته  |
| خواندن کاتالوگ ثابت مجوز نقش  | DEC-P21-005 و DEC-P2-001 | Migration 0009                                  | پذیرش واقعی PostgreSQL و آزمون GRANT | بسته  |
| دعوت عضویت و تیم              | DEC-P2-001               | `modules/organization-administration`           | آزمون دعوت و جداسازی                 | بسته  |
| رابط فارسی RTL                | DEC-UI-001               | `apps/web`                                      | آزمون متن، RTL و عدم Browser Storage | بسته  |

## EVD-042 — شاهد پذیرش نهایی مسیر اصلاح رابط P2R

| نیاز یا ناوردایی        | تصمیم یا خط‌مبنا                | پیاده‌سازی                      | آزمون و شاهد                                                  | وضعیت |
| ----------------------- | ------------------------------- | ------------------------------- | ------------------------------------------------------------- | ----- |
| چندزبانه و جهت صفحه     | `UI-BASELINE-P2R-001`           | `apps/web`                      | English و فارسی با LTR و RTL                                  | بسته  |
| سیستم طراحی مشترک       | `UI-DESIGN-SYSTEM-P2R-001`      | `packages/ui`                   | Typecheck، Lint و Build                                       | بسته  |
| پوسته واکنش‌گرا         | `UI-DASHBOARD-SHELL-P2R-001`    | Dashboard Shell                 | موبایل و دسکتاپ بدون سرریز افقی                               | بسته  |
| ورود و انتخاب سازمان    | `UI-IDENTITY-ENTRY-P2R-001`     | صفحات هویت و سازمان             | آزمون قرارداد و مرورگر                                        | بسته  |
| اعضا دعوت‌ها و تیم‌ها   | `UI-ORGANIZATION-ADMIN-P2R-001` | صفحات مدیریت سازمان             | آزمون قرارداد، حالت‌ها و مرورگر                               | بسته  |
| دسترس‌پذیری             | `UI-ACCESSIBILITY-P2R-001`      | Focus، کنتراست و Reduced Motion | Playwright، Axe و Google Chrome                               | بسته  |
| پذیرش نهایی مسیر اصلاحی | `UI-P2R-FINAL-ACCEPTANCE-001`   | کل دامنه P2R                    | ساخت تولیدی، Smoke، بازگشت کامل آزمون‌ها و صفر خطای Lint جدید | بسته  |

<!-- ORGAWORK:VERIFICATION-INFRASTRUCTURE-TRACEABILITY:START -->

# ردیابی زیرساخت Verification و Stage Closure

| شناسه         | نیاز                                                            | پیاده‌سازی                                                                                    | آزمون                                                                      | شاهد                                                |
| ------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| QG-VERIFY-001 | اجرای آزمون متناسب با ریسک و بدون انتخاب دستی Scriptهای پراکنده | `tools/verification/gates.ts`, `tools/verification/runner.ts`, `tools/verification/stages.ts` | `tools/verification/runner.test.ts`                                        | گزارش JSON Runner                                   |
| QG-CLOSE-001  | جلوگیری از بسته‌شدن Stage بدون Docs، Evidence، Commit و Tag     | `tools/verification/closure.ts`, `tools/verification/publish.ts`                              | `tools/verification/closure.test.ts`, `tools/verification/publish.test.ts` | Acceptance Report + Closure Commit + Acceptance Tag |
| QG-CI-001     | یک منبع حقیقت برای Gateهای Local و CI با حفظ Parallelism        | `.github/workflows/ci.yml`, `tools/verification/gates.ts`                                     | `tools/checks/ci-contract.test.ts`, `tools/checks/p1.8-acceptance.test.ts` | CI artifacts + verification report                  |

<!-- ORGAWORK:VERIFICATION-INFRASTRUCTURE-TRACEABILITY:END -->

<!-- ORGAWORK:TRACE:VERIFICATION-STATE-001 -->

## Verification state and timeout policy

| شناسه                      | نیاز                                         | پیاده‌سازی                                                                                | آزمون                                                            | وضعیت  |
| -------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------ |
| `VERIFICATION-STATE-001`   | Historical Acceptance مستقل از Current-State | `tools/verification/project-state.ts`                                                     | project-state/current-state/P1-P2 regression                     | 00F-A4 |
| `VERIFICATION-TIMEOUT-001` | timeout متناسب با کلاس تست                   | `tools/verification/test-policy.ts`، `vitest.acceptance.config.ts`، `vitest.ci.config.ts` | `tools/verification/test-policy.test.ts` و Acceptance regression | 00F-A4 |

<!-- ORGAWORK:TRACE:VERIFICATION-SYSTEM-001 -->

| `VERIFICATION-SYSTEM-001` | Session/Agent جدید بتواند روش بررسی و ادامه پروژه را فقط از Repository بازسازی کند | `docs/VERIFICATION-SYSTEM.md`، `docs/CONTINUATION-PROTOCOL.md` | `tools/checks/verification-system-documentation.test.ts` | پیاده‌سازی در 00F-B |
| `SECURITY-DEPS-001` | صفر High در Production dependency audit | Next Patch + pnpm-workspace.yaml scoped overrides | `pnpm audit --prod --audit-level=high` و Clean-runner Full | پیاده‌سازی در 00F-B |

# دفتر اختتام استاندارد مراحل

<!-- ORGAWORK:STAGE-CLOSURE-LEDGER:START -->

| مرحله    | شاهد    | Commit فنی                                 | Tag پذیرش                            | گزارش پذیرش                              | وضعیت        |
| -------- | ------- | ------------------------------------------ | ------------------------------------ | ---------------------------------------- | ------------ |
| STAGE-00 | EVD-043 | `4b858c5b87b330ad46feb9018c9e7a7b45d1311d` | `stage-00-trust-baseline-acceptance` | `docs/acceptance/STAGE-00-ACCEPTANCE.md` | آماده انتشار |

<!-- ORGAWORK:STAGE-CLOSURE-LEDGER:END -->
