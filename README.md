# OrgaWork

سامانه سازمانی مدیریت کار، پرونده، مسئولیت، پیگیری، یادآور و گزارش.

## وضعیت فعلی

مدل اجرایی پروژه از 2026-08-19 به **Capability + Vertical Slice** تغییر کرده است.

منبع وضعیت جاری:

1. `project-state.json`
2. `ORGAWORK-MASTER-HANDOFF.md`
3. `docs/PROJECT-STATUS.md`
4. `docs/ROADMAP.md`

مدل تاریخی `P0` تا `P12` برای شواهد و ردیابی گذشته حفظ می‌شود، اما برای کار آینده مدل اجرایی نیست.

## معماری

OrgaWork یک Modular Monolith با چهار برنامه اجرایی است:

- `apps/web`
- `apps/api`
- `apps/worker`
- `apps/scheduler`

قابلیت‌های جدید به‌صورت Vertical Slice ساخته می‌شوند. هر قابلیت کاربرمحور در همان Slice رابط کاربری، API، منطق کاربردی، داده و تست‌های لازم را همراه دارد.

جزئیات: `docs/ARCHITECTURE.md`

## رابط کاربری

بنیاد UI قبلاً در P2R ساخته شده و حفظ می‌شود:

- `@workspace/ui`
- Next.js
- `next-intl`
- Vazirmatn
- LTR/RTL
- English-first در توسعه
- فارسی به‌عنوان زبان پیش‌فرض نسخه نهایی

مراجع طراحی منجمد پروژه همچنان Studio Admin، Kiranism Dashboard و TailAdmin Next.js هستند.

## کیفیت

Loop روزمره توسعه باید سریع باشد. تست‌های تاریخی و Regression کامل در Loop هر Patch اجرا نمی‌شوند.

جزئیات: `docs/QUALITY.md`

## تاریخچه اعتماد

Stage 00 رسماً بسته و منتشر شده است:

- Evidence: `EVD-043`
- Technical commit: `4b858c5b87b330ad46feb9018c9e7a7b45d1311d`
- Closure commit: `81a71b41c05055ad028df94447d677f08f2dcc36`
- Tag: `stage-00-trust-baseline-acceptance`
