# Roadmap OrgaWork

## مدل اجرایی

از 2026-08-19 اجرای آینده پروژه بر اساس این سلسله‌مراتب است:

`Release -> Capability -> Milestone -> Vertical Slice -> Task`

مدل `P0` تا `P12` برای تاریخچه و Traceability گذشته حفظ شده، اما ترتیب اجرایی آینده نیست.

نسخه تاریخی Roadmap قبلی در:

`docs/history/ROADMAP-P-MODEL-20260819.md`

نگهداری می‌شود.

## تعریف Done

### Task

یک تغییر کوچک مهندسی است. Task به Acceptance، Tag یا به‌روزرسانی چند سند نیاز ندارد.

### Vertical Slice

یک رفتار قابل استفاده است. اگر قابلیت کاربرمحور باشد، Slice شامل UI لازم نیز هست.

Slice بسته به نیاز می‌تواند شامل این مسیر باشد:

`UI -> API -> Application -> Domain -> Transaction -> PostgreSQL/RLS -> Response`

Definition of Done یک Slice:

- رفتار اصلی قابل استفاده
- خطاهای اصلی قابل فهم
- Authorization لازم
- Tenant isolation در مرزهای مرتبط
- Unit/Integration هدفمند
- UI در قابلیت‌های user-facing
- بدون الزام به Full Historical Regression

### Milestone

چند Slice که یک خروجی معنادار محصول می‌سازند.

در Milestone، تست‌های گسترده‌تر همان Capability، امنیت، دیتابیس و مرورگر بر اساس boundaryهای تغییرکرده اجرا می‌شوند.

### Release

Regression کامل، Historical Acceptance، امنیت سراسری، Migration replay، Build کامل و readiness عملیاتی در Release انجام می‌شود.

## R1 - Version 1

### Capability WM - Work Management

مالک Case، Responsibility، Action، Current Work و وضعیت‌های follow-up.

#### WM-A - Case Intake

- [ ] `WM-01` Create Own Case
  - فرم ایجاد پرونده در Dashboard
  - API command
  - authorization
  - transaction/idempotency
  - Case + self primary Responsibility + initial Action + Current Work
  - PostgreSQL/RLS
  - انتقال به Case Detail
- [ ] `WM-02` Case List and Detail
  - فهرست پرونده‌های قابل مشاهده
  - جزئیات پرونده
  - empty/loading/error states
- [ ] `WM-03` Create Assigned Case
  - انتخاب Membership/Team
  - pending Responsibility
  - acceptance UI

#### WM-B - Responsibility and Action Flow

- [ ] `WM-04` Accept / Reject / Forced Acceptance
- [ ] `WM-05` Primary and Secondary Actions
- [ ] `WM-06` Complete Action with Outcome and Continuation
- [ ] `WM-07` Transfer Responsibility and Current Work

#### WM-C - Follow-up and Lifecycle

- [ ] `WM-08` Wait / Block / Pause / Decision
- [ ] `WM-09` Resolve / Close / Reopen / Cancel
- [ ] `WM-10` Durable source facts for timeline/audit

#### WM-D - Work Management Hardening

- [ ] `WM-11` concurrency and idempotency
- [ ] `WM-12` authorization matrix and cross-tenant negative tests
- [ ] `WM-13` browser acceptance for core Work Management flows

### Capability AT - Attention and Reminders

#### AT-A - Reminder Basics

- [ ] `AT-01` Set reminder from UI
- [ ] `AT-02` Persist reminder intent and revision
- [ ] `AT-03` Scheduler dispatch
- [ ] `AT-04` Worker delivery
- [ ] `AT-05` Notification surface in UI

#### AT-B - Reliability

- [ ] `AT-06` retry/backoff
- [ ] `AT-07` recurrence
- [ ] `AT-08` lease/recovery
- [ ] `AT-09` reminder milestone acceptance

### Capability CR - Collaboration and Record

#### CR-A - Timeline and Collaboration

- [ ] `CR-01` timeline read model
- [ ] `CR-02` comments
- [ ] `CR-03` mentions/followers
- [ ] `CR-04` collaboration UI

#### CR-B - Files

- [ ] `CR-05` secure attachment upload
- [ ] `CR-06` private download/authorization
- [ ] `CR-07` attachment UI

### Capability VI - Visibility and Organization

#### VI-A - Work Visibility

- [ ] `VI-01` My Work
- [ ] `VI-02` manager visibility
- [ ] `VI-03` snapshots and exports

#### VI-B - Find and Organize

- [ ] `VI-04` search
- [ ] `VI-05` projects
- [ ] `VI-06` contacts
- [ ] `VI-07` reporting views

### Capability PR - Production Readiness

#### PR-A - Hardening

- [ ] `PR-01` full security regression
- [ ] `PR-02` performance and concurrency targets
- [ ] `PR-03` backup/restore and operational recovery

#### PR-B - Deployment

- [ ] `PR-04` deployment
- [ ] `PR-05` monitoring/alerts
- [ ] `PR-06` production configuration

#### PR-C - Release

- [ ] `PR-07` full migration replay
- [ ] `PR-08` full historical regression
- [ ] `PR-09` release acceptance
- [ ] `PR-10` version `1.0.0`

## نگاشت مدل قدیمی

این نگاشت فقط برای حفظ Scope و Traceability است:

| مدل قدیمی       | مدل جدید                    |
| --------------- | --------------------------- |
| P3 + P4         | Work Management             |
| P5              | Attention and Reminders     |
| P6 + P7         | Collaboration and Record    |
| P8 + P9         | Visibility and Organization |
| P10 + P11 + P12 | Production Readiness        |

هیچ Scope پذیرفته‌شده‌ای صرفاً به‌خاطر حذف مدل اجرایی P حذف نشده است.

## اصول ثابت

- UI Stage آخر نیست؛ بخشی از Slice کاربرمحور است.
- Security و Tenant Isolation به انتهای پروژه موکول نمی‌شوند.
- Migration اعمال‌شده rewrite نمی‌شود.
- PostgreSQL منبع حقیقت داده پایدار است.
- default deny حفظ می‌شود.
- Commit روزمره Acceptance نیست.
- Formal Acceptance روی Milestone/Release انجام می‌شود، نه هر Task.
