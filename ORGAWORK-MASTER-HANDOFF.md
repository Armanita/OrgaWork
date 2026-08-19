# ORGAWORK MASTER HANDOFF

## وضعیت اجرایی فعال

OrgaWork از 2026-08-19 با مدل **Capability + Vertical Slice** ادامه پیدا می‌کند.

برای تشخیص وضعیت جاری، این ترتیب را بخوان:

1. `project-state.json`
2. `docs/PROJECT-STATUS.md`
3. `docs/ROADMAP.md`
4. `docs/ARCHITECTURE.md`
5. `docs/QUALITY.md`
6. `docs/DECISIONS.md`

اسناد قدیمی P-stage و Acceptance تاریخی فقط در صورت نیاز به شاهد گذشته خوانده می‌شوند.

## وضعیت Git و تاریخچه

Stage 00 بسته و منتشر شده است:

- Evidence: `EVD-043`
- Technical commit: `4b858c5b87b330ad46feb9018c9e7a7b45d1311d`
- Closure commit: `81a71b41c05055ad028df94447d677f08f2dcc36`
- Acceptance tag: `stage-00-trust-baseline-acceptance`

آخرین Product Substage پذیرفته‌شده در مدل تاریخی:

- `P3.1`

مدل P برای اجرای آینده retired شده است. `P3.2` دیگر نام گام اجرایی جاری نیست.

P3 re-audit در 2026-08-18 انجام شد و blocker قدیمی «قبل از P3.2 دوباره audit کن» با تصمیم معماری 2026-08-19 جایگزین شده است.

کار P3 پیش از بازطراحی بدون حذف تاریخچه در این branch حفظ شده است:

- branch: `archive/pre-architecture-p3-wip-20260819`
- commit: `c8b4f76156380049d990b25d93064d7f98349813`

Branch توسعه معماری:

- `architecture/vertical-slices-v1`

`main` تا زمانی که Milestone پذیرفته نشده، baseline منتشرشده باقی می‌ماند.

## Next Action

قابلیت جاری:

- Release: `R1`
- Capability: `WM - Work Management`
- Milestone: `WM-A - Case Intake`
- Slice: `WM-01 - Create Own Case`

پس از commit کنترل‌پلین معماری:

1. `modules/work-management` ساخته می‌شود.
2. یافته‌های پذیرفته‌شده P3 به آن منتقل می‌شوند، نه اینکه کورکورانه restore شوند.
3. authorization تراکنش‌پذیر از module عمومی به cross-cutting package استخراج می‌شود.
4. `WM-01` از UI تا PostgreSQL/RLS end-to-end ساخته می‌شود.
5. UI بخشی از Definition of Done همان Slice است.

## خطوط قرمز امنیتی

همیشه حفظ شوند:

- default deny
- organization isolation
- `orgawork_runtime`
- `orgawork.organization_id`
- ENABLE + FORCE RLS برای داده‌های tenant-aware
- composite tenant foreign keys در مرزهای دامنه
- authorization و write حساس در یک organization transaction
- no PUBLIC privileges
- ایجاد Organization فقط از مسیر platform-controlled provisioning مجاز است؛ self-service organization creation ممنوع است.
- ایجاد یا اعطای نقش `organization_admin` از tenant RBAC ممنوع است؛ این نقش فقط از مسیر provisioning سکو و با Audit صریح ایجاد/اعطا می‌شود.
- `organization_admin` داخل سازمان فقط `member` و `manager` را مدیریت می‌کند و حق self-elevation یا grant کردن `organization_admin` ندارد.
- عدم چاپ یا commit Secret
- `.env.local` ignored و untracked
- عدم rewrite Migration history

## Git Safety

ممنوع:

- `git reset --hard`
- `git clean -fd`
- force push
- history rewrite
- migration rewrite

Commit توسعه با Acceptance یکسان نیست. Commitهای feature branch checkpoint مهندسی‌اند. Formal acceptance در Milestone/Release انجام می‌شود.

## روش کار

- با کاربر فارسی صحبت کن.
- برای کار چندمرحله‌ای یک `.ps1` بده و فقط یک فرمان برای اجرا بده.
- Build موفق به‌تنهایی Acceptance نیست.
- Historical Acceptance در Loop روزمره اجرا نمی‌شود.
- اگر branch، HEAD، remote یا فایل‌های محلی با `project-state.json` ناسازگار باشند، قبل از mutation اختلاف را تشخیص بده.
