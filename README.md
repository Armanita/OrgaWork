# OrgaWork

OrgaWork سامانه مدیریت کار سازمانی و چندسازمانی است.

معماری پروژه Modular Monolith است و قابلیت‌ها به‌صورت Capability + Vertical Slice توسعه داده می‌شوند.

## وضعیت جاری

شاخه اصلی توسعه و مرجع جاری پروژه:

`main`

قابلیت‌های موجود در مخزن شامل این بخش‌ها هستند:

- Authentication و Session
- Organization Context
- Organization Administration
- Platform Control Plane
- Work Management و ایجاد پرونده شخصی
- Tenant Isolation و PostgreSQL RLS

## مستندات جاری

فقط اسناد داخل `docs/` مرجع فعال توسعه هستند:

- `docs/SYSTEM-BEHAVIOR.md` — رفتار سیستم
- `docs/DEVELOPMENT-METHOD.md` — روش توسعه
- `docs/FEATURE-SPECIFICATION.md` — روش تعریف قابلیت
- `docs/ACCEPTANCE.md` — پذیرش قابلیت
- `docs/ARCHITECTURE-NOTES.md` — تصمیم‌های معماری جاری

اسناد قدیمی خارج از Repository آرشیو شده‌اند و نباید برای تعیین گام بعدی توسعه استفاده شوند.

## اصل ادامه کار

ابتدا نیاز واقعی محصول مشخص می‌شود، سپس رفتار، طراحی، پیاده‌سازی Slice کامل و تست دستی انجام می‌شود.

گام بعدی پروژه از روی P-stageهای تاریخی یا Roadmap قدیمی استنتاج نمی‌شود.
