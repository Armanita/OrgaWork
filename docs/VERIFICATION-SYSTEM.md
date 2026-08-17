# OrgaWork Verification System

این سند قرارداد عملیاتی مرکزی برای بررسی، ادامه توسعه و بستن Stageهای OrgaWork است. هر Session، Agent یا توسعه‌دهنده جدید باید قبل از تغییر کد، وضعیت Repository را از خود Git و اسناد Canonical بازسازی کند و به حافظه Chat یا حدس متکی نباشد.

## 1. Bootstrap هر Session جدید

ترتیب اجباری شروع کار:

1. `docs/PROJECT-STATUS.md` را بخوان.
2. `docs/ROADMAP.md` را بخوان.
3. `docs/CONTINUATION-PROTOCOL.md` را اجرا کن.
4. این سند، `docs/VERIFICATION-SYSTEM.md`، را بخوان.
5. `git status --short --branch`، `git rev-parse HEAD` و وضعیت `origin/main` را بررسی کن.
6. Stage جاری و آخرین Stage پذیرفته‌شده را فقط از اسناد Canonical و Evidence معتبر تعیین کن.
7. تغییرات Staged/Unstaged موجود را متعلق به کار جاری فرض نکن؛ منشأ و هدفشان باید مشخص شود.
8. `.env.local` و Secretها هرگز نباید Track یا چاپ شوند.

## 2. منبع حقیقت Verification

Runner مرکزی:

- `pnpm verify:fast`
- `pnpm verify:stage -- --stage <stage-id>`
- `pnpm verify:full`
- `pnpm verify:infra`
- `pnpm verify:ci -- --suite <suite-id>`

تعریف Gateها در `tools/verification/gates.ts` و تعریف Stageها در `tools/verification/stages.ts` منبع حقیقت اجرایی هستند. GitHub Actions نباید منطق مستقل و متفاوتی از Runner محلی بسازد.

## 3. پروفایل‌ها

### Fast

برای Loop روزمره توسعه است. فایل‌های تغییرکرده را Format/Lint می‌کند، TypeScript و تست‌های مرتبط را اجرا می‌کند و در مسیرهای حساس Architecture/Security را اضافه می‌کند.

### Stage

برای پذیرش فنی یک Stage مشخص است. Gateهای Stage باید از Registry مرکزی بیایند. Build به‌تنهایی Acceptance نیست.

### Full

برای Regression کامل، تغییر Toolchain/CI، بسته‌شدن Stageهای حساس و قبل از Publication استفاده می‌شود.

### Infra

برای Migration، Architecture و Repository Security است.

### CI

GitHub Actions از همان Runner مرکزی و Suiteهای Registry استفاده می‌کند تا Local و CI دو تعریف متفاوت نداشته باشند.

## 4. Historical Acceptance و Current-State

سه مفهوم مستقل هستند:

- **Historical Acceptance:** شواهد و قرارداد Stage بسته‌شده را ثابت می‌کند و نباید Current Stage را روی گذشته منجمد کند.
- **Current-State Invariants:** وضعیت زنده Roadmap/Project Status را بررسی می‌کند.
- **Current Stage Acceptance:** فقط Gateهای Stage فعال را اجرا می‌کند.

پیشروی طبیعی پروژه نباید Acceptance تاریخی P1/P2/P2R را خراب کند.

## 5. Timeout Policy

منبع حقیقت: `tools/verification/test-policy.ts`

- Unit / تست سریع: 5 ثانیه.
- Acceptance و CI repository-wide: 30 ثانیه.
- Publication/Git integration: 60 ثانیه.

Timeout بزرگ‌تر فقط برای کلاس تست سنگین است؛ Unit testها نباید با Timeout سراسری بزرگ، Hang را پنهان کنند.

## 6. Stage Closure

چرخه استاندارد:

1. Technical implementation کامل می‌شود.
2. Working tree برای Technical commit تمیز می‌شود.
3. Technical commit ایجاد می‌شود.
4. `pnpm verify:stage -- --stage <stage-id>` روی همان HEAD تمیز اجرا می‌شود.
5. Evidence باید PASS، متعلق به همان Stage و همان `gitHead` باشد و `changedFiles` آن خالی باشد.
6. `pnpm stage:close:prepare -- --stage <stage-id> --evidence <evidence-id>` اسناد Closure را آماده می‌کند.
7. Diff اسناد Closure بازبینی می‌شود.
8. `pnpm stage:close:publish -- --stage <stage-id> --evidence <evidence-id>` Closure commit، Acceptance tag و Push اتمیک را انجام می‌دهد.

هیچ Stage فقط با Build موفق یا سبزشدن یک Test منفرد PASS محسوب نمی‌شود.

## 7. اسناد الزامی Closure

اسناد اصلی که Closure باید هم‌راستا نگه دارد:

- `docs/PROJECT-STATUS.md`
- `docs/ROADMAP.md`
- `docs/IMPLEMENTATION-JOURNAL.md`
- `docs/TRACEABILITY-MATRIX.md`

اسناد Review/Policy:

- `docs/TEST-AND-ACCEPTANCE.md`
- `docs/RISKS-ASSUMPTIONS-DEBT.md`
- `docs/DECISIONS.md`
- `docs/DOCUMENTATION-CHANGE-POLICY.md`

## 8. امنیت و Tenant Isolation

Gateهای Security/Architecture مستقل از Build هستند. برای مسیرهای tenant-aware:

- Default deny حفظ می‌شود.
- Runtime role نباید Superuser یا `BYPASSRLS` باشد.
- Tenant context باید Transaction-local باشد.
- Migration، RLS، Role و Repository contract باید با هم سازگار باشند.
- تغییر Migration اعمال‌شده یا History rewrite بدون فرآیند صریح ممنوع است.

## 9. Clean-runner Validation

قبل از اعلام سبزشدن نهایی CI برای تغییرات زیرساختی، فقط اجرای Local روی Working tree کافی نیست؛ `dist` یا Artifact قدیمی می‌تواند False Positive بسازد.

روش استاندارد:

1. Snapshot دقیق Staged index با `git write-tree`.
2. ساخت Commit موقت غیرمرجعی با `git commit-tree`.
3. ایجاد Detached temporary worktree از همان Snapshot.
4. `pnpm install --frozen-lockfile`.
5. اجرای `pnpm verify:full -- --continue`.
6. حذف temporary worktree.

این Commit موقت نباید Branch، Tag یا Remote را تغییر دهد.

## 10. قواعد ایمنی Git

بدون علت و Evidence روشن استفاده نشود:

- `git reset --hard`
- `git clean -fd`
- History rewrite
- Force push
- بازنویسی Migrationهای اعمال‌شده

Rollback ابزارهای Verification باید فقط تغییرات همان ابزار را برگرداند و Staged baseline قبلی را حفظ کند.

## 11. Dependency Security

`pnpm audit --prod --audit-level=high` Gate اجباری Full/CI است. Override فقط برای نسخه آسیب‌پذیر Transitive و با حداقل دامنه لازم استفاده می‌شود. در pnpm 11، overrideهای Repository در `pnpm-workspace.yaml` نگهداری می‌شوند، نه در `package.json`. Upgrade Framework باید جداگانه Build/Test شود و Lockfile بعد از تغییر با `--frozen-lockfile` روی Clean runner اثبات شود.

## 12. شرط ادامه توسعه

اگر Session جدید وضعیت Git، Stage جاری، Evidence یا اسناد Canonical را نتواند با اطمینان بازسازی کند، نباید Feature جدید را شروع کند. ابتدا Verification/Continuation contract باید بازسازی و هم‌راستا شود.
