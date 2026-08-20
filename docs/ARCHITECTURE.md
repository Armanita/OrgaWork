# معماری OrgaWork

## تصمیم کلان

OrgaWork یک **Modular Monolith** باقی می‌ماند.

چهار executable مستقل حفظ می‌شوند:

- `apps/web`
- `apps/api`
- `apps/worker`
- `apps/scheduler`

Microservices، Event Sourcing کامل و Generic Workflow Engine برای v1 وارد نمی‌شوند.

## اصل جدید سازمان‌دهی کد

ماژول‌های محصول بر اساس **Bounded Context / Capability** ساخته می‌شوند، نه بر اساس Entity.

ساختار هدف:

```text
apps/
  web/
  api/
  worker/
  scheduler/

modules/
  work-management/
  attention/
  collaboration-record/
  visibility/

packages/
  contracts/
  database/
  access-control/
  security/
  observability/
  queue/
  storage/
  ui/
  ...
```

ماژول‌های قدیمی پذیرفته‌شده یک‌باره حذف نمی‌شوند. Migration به روش strangler و هنگام لمس Capability انجام می‌شود.

## Work Management

`modules/work-management` مالک این مفاهیم است:

- Case
- Responsibility
- Action
- Current Work
- Wait
- Block
- Pause
- Decision
- Case lifecycle

ساختار داخلی هدف:

```text
modules/work-management/
  src/
    domain/
    application/
    infrastructure/
    index.ts
```

Entityها مستقل می‌مانند، ولی Workspace مستقل ندارند.

ماژول‌های قدیمی زیر منبع Migration هستند و پس از شروع مدل جدید محل افزودن Feature جدید نیستند:

- `modules/cases`
- `modules/assignments`
- `modules/actions`
- `modules/followup-state`

## Application Layer

Application command داخل Capability module قرار می‌گیرد، نه داخل `apps/api`.

نمونه:

```text
HTTP route
  -> application command
  -> authorization
  -> domain
  -> transaction/repository
  -> outbox
  -> result
```

`apps/api` مسئول transport/composition است:

- parse/validate request
- session/CSRF/organization actor context
- call application command
- map result/error to HTTP

Business orchestration نباید در route رشد کند.

## Authorization

Authorization یک concern سراسری است، نه Product Entity.

هدف Migration:

- policy و repository primitiveهای عمومی از `modules/authorization` به `packages/access-control` منتقل شوند.
- access-control بتواند روی **transaction موجود** query اجرا کند.
- command حساس Work Management یک organization transaction باز کند.
- membership/permission/explicit deny داخل همان transaction load شوند.
- تصمیم authorization، lock/version check و write در همان transaction انجام شوند.
- authorization audit/outbox مرتبط نیز در همان مرز ثبت شود.

Nested authorization transaction برای write حساس معماری نهایی نیست.

## Repository و Transaction

Repositoryها برای هر Entity به orchestration مستقل تبدیل نمی‌شوند.

هر Capability یک Unit of Work تراکنشی دارد. برای Work Management:

```text
WorkManagementTransaction
  cases
  responsibilities
  actions
  currentWork
  idempotency
  outbox
```

عملیات چندموجودیتی باید atomic باشند.

## Data

- PostgreSQL منبع حقیقت داده پایدار
- Redis فقط queue/lease/هماهنگی زودگذر
- S3-compatible storage برای فایل
- Outbox برای facts/events پایدار
- idempotency برای commandهای تکرارپذیر

## Multi-tenancy

برای داده tenant-aware:

- organization ownership صریح
- `orgawork.organization_id` transaction-local
- runtime role: `orgawork_runtime`
- ENABLE + FORCE RLS
- policy برای runtime role
- composite tenant FK در مرزهای لازم
- no PUBLIC privilege
- default deny
- cross-tenant negative tests در Milestone مربوط

## Web

`apps/web` باید برای Featureهای جدید از API typed client استفاده کند.

دسترسی مستقیم Web به database/queue/storage برای Product Feature جدید مجاز نیست. وابستگی‌های تاریخی connectivity تا زمان Migration مرتبط می‌توانند باقی بمانند.

## UI

Foundation فعلی حفظ می‌شود:

- `@workspace/ui`
- Next.js
- Tailwind
- `next-intl`
- Vazirmatn
- Theme
- Responsive
- LTR/RTL

مراجع طراحی پذیرفته‌شده:

- Studio Admin: shell/sidebar/header
- Kiranism Dashboard: provider/theme/admin tables
- TailAdmin Next.js: login/full-width patterns

روش اجرا:

- development: English-first
- infrastructure: en + fa از ابتدا
- final default: فارسی
- final direction: RTL برای فارسی
- تاریخ عمومی نهایی: هجری شمسی

UI بخشی از Vertical Slice است و به انتهای Capability موکول نمی‌شود.

## Dependency Rule

اصل پیش‌فرض:

- app -> module/package
- module -> package
- package -> package
- module -> module ممنوع
- app -> app ممنوع

به‌جای بازکردن module-to-module، concernهای واقعاً cross-cutting به package استخراج می‌شوند.

## Migration Strategy

این بازطراحی Big Bang نیست.

1. control-plane و Roadmap جدید
2. Work Management bounded context
3. access-control transaction-aware
4. WM-01 end-to-end
5. Capabilityهای بعدی هنگام رسیدن به آن‌ها consolidate می‌شوند

کد پذیرفته‌شده P2 بدون دلیل بازنویسی نمی‌شود.
