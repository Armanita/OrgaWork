# وضعیت جاری OrgaWork

## Snapshot

- مدل اجرا: `Capability + Vertical Slice`
- Release جاری: `R1`
- Capability جاری: `WM - Work Management`
- Milestone جاری: `WM-A - Case Intake`
- Slice جاری: `WM-01 - Create Own Case`
- وضعیت Slice: `planned`
- Branch توسعه: `architecture/vertical-slices-v1`
- Branch منتشرشده: `main`

منبع machine-readable: `../project-state.json`

## اعتماد منتشرشده

Stage 00 همچنان آخرین trust baseline رسمی منتشرشده است:

- Evidence: `EVD-043`
- Technical commit: `4b858c5b87b330ad46feb9018c9e7a7b45d1311d`
- Closure commit: `81a71b41c05055ad028df94447d677f08f2dcc36`
- Acceptance tag: `stage-00-trust-baseline-acceptance`

این baseline با Migration معماری باز نمی‌شود.

## مدل تاریخی P

- آخرین Product Substage پذیرفته‌شده: `P3.1`
- `P3.2` در مدل قدیمی پذیرفته نشده است.
- مدل P برای اجرای آینده از 2026-08-19 retired شده است.
- تاریخچه P0/P1/P2/P2R/P3.1 برای Evidence حفظ می‌شود.

P3 re-audit در 2026-08-18 تکمیل شد. کار حاصل از آن قبل از بازطراحی در branch زیر محفوظ است:

- `archive/pre-architecture-p3-wip-20260819`
- commit `c8b4f76156380049d990b25d93064d7f98349813`

این branch منبع restore کورکورانه نیست؛ فقط inventory و منبع انتقال انتخابی است.

## معماری جاری

معماری کلان حفظ می‌شود:

- Modular Monolith
- Web
- API
- Worker
- Scheduler
- PostgreSQL منبع حقیقت داده پایدار
- Redis برای queue/lease/هماهنگی زودگذر
- S3-compatible storage برای فایل
- Outbox برای رخدادهای پایدار

تغییر اصلی در داخل Modular Monolith است: ماژول‌های آینده بر اساس Bounded Context/Capability سازمان‌دهی می‌شوند، نه Entity.

## UI

Foundation UI موجود و پذیرفته‌شده حفظ می‌شود:

- Dashboard shell
- Design System
- Theme
- Responsive
- `next-intl`
- English + فارسی
- LTR + RTL
- Vazirmatn

از `WM-01` به بعد رابط کاربری در همان Vertical Slice متصل می‌شود.

## ناوردای امنیتی Provisioning سازمان

تصمیم پذیرفته‌شده `DEC-SEC-2026-001`:

- ایجاد Organization به‌صورت self-service برای کاربران محصول مجاز نیست.
- اولین `organization_admin` فقط از مسیر platform-controlled provisioning ایجاد/اعطا می‌شود.
- `organization_admin` در tenant می‌تواند اعضای `member` و `manager` را مدیریت کند، اما حق اعطای `organization_admin` به خود یا دیگران را ندارد.
- نقش فنی `platform_operator` به‌خودی‌خود هیچ دسترسی ضمنی به داده tenant ایجاد نمی‌کند؛ provisioning باید مسیر صریح، محدود و ممیزی‌شده مستقل از tenant RBAC داشته باشد.
- Seed توسعه فقط برای دیتابیس توسعه اختصاصی مجاز است و قرارداد provisioning تولیدی محسوب نمی‌شود.

### شکاف اجرایی شناخته‌شده

- self-service Organization creation در محصول فعلی پیاده‌سازی نشده است و طبق این تصمیم نباید اضافه شود.
- API تاریخی مدیریت نقش tenant در snapshot فعلی هنوز `organization_admin` را در ورودی role replacement می‌پذیرد. این رفتار با تصمیم جدید ناسازگار است و باید در `OA-03` پیش از استفاده تولیدی از این عملیات محدود شود.
- مسیر تولیدی platform-controlled برای ساخت Organization و اولین Organization Admin هنوز پیاده‌سازی نشده و در Capability `OA` برنامه‌ریزی شده است.

## Next Action

پس از تثبیت این کنترل‌پلین:

1. ایجاد `modules/work-management`
2. استخراج access-control تراکنش‌پذیر از authorization عمومی
3. انتقال انتخابی قراردادهای معتبر Case/Responsibility/Action/Current Work
4. پیاده‌سازی `WM-01` از UI تا DB
5. اجرای فقط تست‌های DEV/SLICE مرتبط

هیچ Stage tag یا product closure در این Migration معماری ساخته نمی‌شود.
