# OrgaWork System Behavior

## هدف سیستم

OrgaWork برای مدیریت کار سازمانی، اعضا، پرونده‌ها، مسئولیت‌ها، اقدامات، پیگیری و کنترل دسترسی ساخته می‌شود.

هر سازمان فضای مستقل خود را دارد و داده یک سازمان نباید برای سازمان دیگر قابل مشاهده یا تغییر باشد.

## بازیگران

### Platform Operator

مدیر سراسری سکو است.

می‌تواند:

- Organization ایجاد و مدیریت کند.
- اولین `organization_admin` را برای Organization ایجاد کند.
- مدیر سازمان اضافه یا در صورت مجاز بودن لغو کند.
- Audit عملیات Platform را مشاهده کند.

Platform Operator به‌صورت پیش‌فرض عضو هیچ Organization نیست و حق مشاهده داده Tenant را ندارد.

### Organization Admin

مدیر داخل یک Organization است.

می‌تواند اعضا و دسترسی‌های مجاز سازمان را مدیریت کند.

نمی‌تواند:

- Organization جدید ایجاد کند.
- نقش `organization_admin` را از Tenant RBAC به خود یا دیگران اعطا کند.
- مرز Tenant یا RLS را دور بزند.

### Manager

کاربر سازمانی با اختیارات مدیریتی تعیین‌شده توسط Permissionهای همان Organization است.

### Member

کاربر عادی Organization است و فقط عملیات مجاز خود را انجام می‌دهد.

دعوت‌شده تا زمانی که Membership معتبر نگیرد، نقش Tenant محسوب نمی‌شود.

## رفتارهای فعلی

### Authentication

کاربر با Session معتبر وارد سیستم می‌شود.

درخواست‌های حساس علاوه بر Session باید کنترل‌های امنیتی لازم مانند CSRF را رعایت کنند.

### Organization Context

هر عملیات Tenant به Organization جاری محدود است.

Organization درخواست باید با Organization معتبر Session و مجوز کاربر سازگار باشد.

### Platform Control Plane

مسیر Platform برای مدیریت Organizationها و مدیران اولیه وجود دارد و از Tenant RBAC جدا است.

عملیات مهم Platform Audit می‌شوند.

### Organization Administration

مدیریت اعضا، نقش‌های Tenant و دعوت سازمان از مسیرهای مجاز سازمان انجام می‌شود.

دعوت فعلی بر پایه Email است. طراحی دعوت چندکاناله هنوز رفتار نهایی پذیرفته‌شده سیستم نیست.

### Work Management

کاربر مجاز می‌تواند برای خودش پرونده ایجاد کند.

ایجاد پرونده فعلی شامل:

- عنوان
- شرح
- اولویت
- موعد اختیاری
- اقدام اولیه
- موعد اختیاری اقدام اولیه

درخواست ایجاد باید Idempotent باشد تا ارسال دوباره باعث ایجاد ناخواسته رکورد تکراری نشود.

## قوانین امنیتی ثابت

- Default Deny
- Organization Isolation
- RLS و FORCE RLS برای داده Tenant-aware
- Runtime role بدون RLS bypass
- Organization context صریح
- عدم دسترسی ضمنی Platform Operator به داده Tenant
- عدم اعطای `organization_admin` از Tenant RBAC
- عدم ثبت Secret در Git
- عدم بازنویسی Migration history

## قانون ثبت رفتار

فقط رفتاری که پیاده‌سازی و در جریان واقعی تأیید شده، رفتار جاری سیستم محسوب می‌شود.

قابلیت برنامه‌ریزی‌شده تا قبل از پیاده‌سازی و پذیرش، نباید به‌عنوان رفتار موجود فرض شود.
