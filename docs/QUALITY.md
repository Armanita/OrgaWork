# Quality and Verification

## هدف

Verification باید ریسک را کنترل کند، نه اینکه Loop توسعه را متوقف کند.

مدل جاری چهار سطح دارد:

`DEV -> SLICE -> MILESTONE -> RELEASE`

## 1. DEV

برای هر Patch و هنگام کدنویسی.

شامل فقط موارد مرتبط:

- format/lint فایل‌های تغییرکرده
- typecheck workspace تغییرکرده و dependents لازم
- تست مستقیم فایل‌های تغییرکرده
- related unit/integration tests
- architecture check فقط در تغییرات معماری/dependency
- security check فقط وقتی security boundary لمس شده باشد

Historical Acceptance در Loop روزمره اجرا نمی‌شود.

بودجه هدف:

- معمولاً <= 60s
- کندی دائمی DEV verification یک DevEx defect است

### وضعیت Runner

Runner تاریخی `verify:fast` هنوز با این سیاست کاملاً همسو نشده است.

تا زمان اصلاح کوچک و مستقل Runner:

- `verify:fast` gate اجباری هر Patch نیست.
- برای DEV از commandهای هدفمند همان Slice استفاده می‌شود.
- Full historical acceptance عمداً در توسعه روزمره اجرا نمی‌شود.

این debt نباید جلوی شروع Work Management و UI را بگیرد.

## 2. SLICE

پایان یک Vertical Slice.

علاوه بر DEV:

- integration همان flow
- یک happy-path end-to-end برای قابلیت user-facing
- negative behavior مهم
- DB/RLS/Auth فقط اگر Slice آن boundary را لمس کرده باشد

هدف معمول:

- <= 3 دقیقه برای Slice عادی
- real PostgreSQL فقط برای Sliceهای دیتابیس/امنیت مرتبط

## 3. MILESTONE

پایان چند Slice مرتبط.

شامل gateهای مربوط به Capability و shared boundaryهای تغییرکرده:

- capability regression
- browser flowهای اصلی
- migration replay مربوط
- tenant isolation
- authorization matrix
- concurrency/idempotency در صورت ارتباط
- build برنامه‌های متاثر

Milestone محل batch کردن Status/Roadmap/Traceability است.

## 4. RELEASE

قبل از انتشار رسمی:

- Full repository regression
- Historical Acceptance
- migration replay از صفر
- security/tenant matrix کامل
- build کامل
- E2E کامل
- performance/recovery در محدوده Release
- publication verification

Runner تاریخی `verify:full` تا زمان جایگزینی نهایی، ابزار سازگار Full/Release باقی می‌ماند.

## Golden Rule

اگر یک boundary لمس نشده، gate سنگین آن در Loop روزمره دوباره اجرا نمی‌شود.

استثنا:

- تغییر toolchain
- تغییر shared contract پراثر
- تغییر dependency graph
- تغییر security/migration infrastructure

در این حالت scope Verification بزرگ‌تر می‌شود.

## Historical Acceptance

Acceptanceهای P1/P2/P2R/Stage00 شواهد تاریخی معتبرند.

آن‌ها:

- حذف نمی‌شوند
- بازنویسی نمی‌شوند
- در Full/Release اجرا می‌شوند
- اگر خود فایل Acceptance تغییر کند، مستقیم تست می‌شوند

اما تغییر عادی Work Management نباید باعث اجرای خودکار Acceptance تاریخی شود.

## Security

سرعت با حذف Security به دست نمی‌آید.

در boundary مرتبط همچنان الزامی است:

- default deny
- RLS
- tenant isolation
- runtime role
- transaction-local organization context
- explicit deny
- migration integrity

تفاوت فقط زمان اجراست، نه حذف کنترل.

## Closure

Task و Slice Tag رسمی ندارند.

Commit روزمره checkpoint است.

Formal Evidence/Tag برای Milestone یا Release فقط وقتی تعریف می‌شود که واقعاً ارزش اعتماد/انتشار داشته باشد.

Stage-based closure tooling قدیمی برای Evidence تاریخی حفظ می‌شود، اما مدل اجرای قابلیت‌های جدید نیست.
