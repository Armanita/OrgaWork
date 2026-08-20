# ORGAWORK MASTER HANDOFF

این فایل فقط برای همگام‌سازی سریع یک Session جدید است.

## مرجع جاری

1. Repository و شاخه `main`
2. `docs/SYSTEM-BEHAVIOR.md`
3. `docs/DEVELOPMENT-METHOD.md`
4. `docs/FEATURE-SPECIFICATION.md`
5. `docs/ACCEPTANCE.md`
6. `docs/ARCHITECTURE-NOTES.md`

اسناد قدیمی پروژه خارج از Repository آرشیو شده‌اند و مرجع اجرای آینده نیستند.

## روش ادامه

قبل از تغییر کد:

- وضعیت فعلی `main` بررسی شود.
- رفتار مرتبط در `SYSTEM-BEHAVIOR.md` خوانده شود.
- نیاز جدید کاربر به رفتار قابل تست تبدیل شود.
- فقط ریسک‌های واقعی همان Slice بررسی شوند.
- یک Vertical Slice کامل ساخته شود.
- تست دستی واقعی انجام شود.
- پس از اصلاح، تغییر روی `main` Commit و Push شود.

## وضعیت معماری

- Modular Monolith
- Capability + Vertical Slice
- `main` شاخه اصلی توسعه
- PostgreSQL با Tenant Isolation و RLS

## خطوط قرمز

- Default Deny
- Organization Isolation
- `orgawork_runtime` بدون RLS bypass
- `orgawork.organization_id`
- FORCE RLS برای داده Tenant-aware
- Platform Operator بدون دسترسی ضمنی به Tenant data
- `organization_admin` فقط از مسیر Platform provisioning
- Secret داخل Git ممنوع
- `.env.local` باید ignored و untracked بماند
- Migration اعمال‌شده بازنویسی نمی‌شود
- Force Push و Git history rewrite ممنوع

## Migration

Migrationهای موجود تا `0012` در Repository قرار دارند.

`0011_create-platform-control-plane.sql` و `0012_extend-platform-control-plane-management.sql` نباید بازنویسی شوند.

هر تغییر Database بعدی با Migration جدید `0013+` انجام می‌شود.

## نکته مهم

P-stageهای تاریخی، Roadmapهای قدیمی و شاخه معماری قبلی گام اجرایی جاری را تعیین نمی‌کنند.

گام بعدی از نیاز واقعی محصول و تصمیم کاربر تعیین می‌شود.
