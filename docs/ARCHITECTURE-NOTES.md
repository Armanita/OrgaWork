# OrgaWork Architecture Notes

## معماری جاری

OrgaWork یک Modular Monolith است.

برنامه‌های اجرایی اصلی:

- `apps/web`
- `apps/api`
- `apps/worker`
- `apps/scheduler`

توسعه قابلیت‌ها با مدل Capability + Vertical Slice انجام می‌شود.

جریان معمول یک Slice:

UI → API → Application/Domain Service → Repository → PostgreSQL

## مرزهای ثابت

- منطق قابلیت در Module مربوط به همان قابلیت باقی می‌ماند.
- دسترسی Tenant باید داخل Organization Context معتبر انجام شود.
- داده Tenant-aware باید با RLS محافظت شود.
- `orgawork_runtime` نباید RLS را bypass کند.
- `orgawork.organization_id` زمینه سازمان جاری را مشخص می‌کند.
- Authorization حساس و Write مرتبط باید در یک transaction سازمانی امن انجام شوند.
- Migrationهای اعمال‌شده immutable هستند.
- Secret داخل Git یا خروجی‌های عمومی قرار نمی‌گیرد.

تصمیم معماری جدید فقط زمانی به این فایل اضافه می‌شود که واقعاً برای یک قابلیت لازم باشد.
