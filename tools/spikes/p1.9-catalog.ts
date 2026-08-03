export interface TechnicalSpikeRecord {
  readonly id: `P1.9.${1 | 2 | 3 | 4 | 5}`;
  readonly title: string;
  readonly question: string;
  readonly options: readonly string[];
  readonly evidence: readonly string[];
  readonly limitations: readonly string[];
  readonly decision: {
    readonly status: 'accept' | 'reject' | 'defer';
    readonly text: string;
  };
  readonly technicalDebt: readonly string[];
  readonly classification: 'spike-only';
}

export const p19TechnicalSpikes = [
  {
    id: 'P1.9.1',
    title: 'مرز ماژول‌ها و جلوگیری از وابستگی چرخه‌ای',
    question: 'آیا خط‌مشی معماری فعلی برای Monolith ماژولار قابل اجرا و قابل بازگشت است؟',
    options: [
      'اتکا به بازبینی دستی Importها',
      'ادامه خط‌مشی خودکار فعلی برای Workspace و لایه‌ها',
      'مهاجرت فوری به ابزار سنگین‌تر تحلیل گراف',
    ],
    evidence: [
      'اجرای واقعی architecture-policy روی مخزن',
      'آزمون منفی Cycle، وابستگی اعلام‌نشده و عبور از مرز نسبی',
      'ثبت تعداد Workspaceها و فایل‌های منبع در گزارش Spike',
    ],
    limitations: [
      'Importهای کاملاً پویا با مسیر محاسبه‌شده قابل تحلیل ایستا نیستند',
      'معیار Coupling معنایی هنوز مستقل از Import graph اندازه‌گیری نمی‌شود',
    ],
    decision: {
      status: 'accept',
      text: 'خط‌مشی فعلی حفظ و در CI اجباری می‌شود و ابزار سنگین‌تر فقط در صورت افزایش False Negative بررسی خواهد شد.',
    },
    technicalDebt: ['اندازه‌گیری Coupling معنایی و Importهای پویا به P10 منتقل می‌شود'],
    classification: 'spike-only',
  },
  {
    id: 'P1.9.2',
    title: 'Outbox، تحویل تکراری و بازیابی Lease',
    question:
      'کدام ترکیب برای تحویل حداقل یک‌بار، جلوگیری از اثر تکراری و بازیابی مالک Lease مناسب است؟',
    options: [
      'Lease و منبع حقیقت فقط در Redis',
      'Lease و صف فقط در PostgreSQL',
      'Outbox و Inbox پایدار در PostgreSQL همراه Lease کوتاه‌مدت Redis',
    ],
    evidence: [
      'آزمون رفتاری مدل Outbox و Inbox',
      'آزمون واقعی Unique مرکب در PostgreSQL',
      'آزمون واقعی SET NX PX، انقضا و تصاحب مجدد Lease در Redis',
    ],
    limitations: [
      'Network partition و چند Node واقعی در این Spike شبیه‌سازی نشده است',
      'Throughput صف تا P10 معیارگذاری نمی‌شود',
    ],
    decision: {
      status: 'accept',
      text: 'PostgreSQL منبع حقیقت Outbox و Inbox باقی می‌ماند و Redis فقط Lease و هماهنگی زودگذر را نگهداری می‌کند.',
    },
    technicalDebt: ['Chaos test چند Worker و قطع شبکه به P10 منتقل می‌شود'],
    classification: 'spike-only',
  },
  {
    id: 'P1.9.3',
    title: 'نشست، سازمان جاری و حافظه نهان رابط کاربری',
    question: 'Cache سمت Web چگونه باید از نشت داده پس از تعویض سازمان یا چرخش نشست جلوگیری کند؟',
    options: [
      'Cache سراسری فقط با کلید منبع',
      'Cache با کلید سازمان بدون نسخه نشست',
      'Cache با کلید نسخه نشست، کاربر، سازمان و منبع همراه پاک‌سازی هنگام تغییر زمینه',
    ],
    evidence: ['آزمون تعویض سازمان', 'آزمون چرخش نشست', 'آزمون جداسازی کلیدهای سازمانی'],
    limitations: ['ادغام واقعی با Cache و Router برنامه Next.js تا P2 انجام نمی‌شود'],
    decision: {
      status: 'accept',
      text: 'کلید Cache باید نسخه نشست، کاربر و سازمان را در بر گیرد و تغییر هرکدام Cache سازمانی را نامعتبر کند.',
    },
    technicalDebt: ['آزمون مرورگر تعویض سازمان و Stale Data در P2 افزوده می‌شود'],
    classification: 'spike-only',
  },
  {
    id: 'P1.9.4',
    title: 'RLS، استخر اتصال و زمینه سازمان',
    question:
      'آیا SET LOCAL و تراکنش سازمانی فعلی از نشت Context میان Connectionهای Pool جلوگیری می‌کند؟',
    options: [
      'تنظیم Context در سطح Session و پاک‌سازی دستی',
      'SET LOCAL ROLE و set_config تراکنشی برای هر عملیات سازمانی',
      'Pool مستقل برای هر سازمان',
    ],
    evidence: [
      'آزمون واقعی تراکنش هم‌زمان دو سازمان',
      'بررسی Context تهی پس از Commit و Rollback',
      'بررسی RLS فعال و اجباری در Catalog PostgreSQL',
    ],
    limitations: ['PgBouncer و Proxy عملیاتی هنوز در دامنه نسخه محلی نیستند'],
    decision: {
      status: 'accept',
      text: 'الگوی withOrganizationTransaction با SET LOCAL حفظ می‌شود و Context خارج از تراکنش مجاز نیست.',
    },
    technicalDebt: ['آزمون سازگاری Transaction Pooling در P10 انجام می‌شود'],
    classification: 'spike-only',
  },
  {
    id: 'P1.9.5',
    title: 'محدودیت‌ها و روابط مرکب پایگاه داده',
    question:
      'آیا یکتایی و روابط چندسازمانی باید فقط در Application یا در خود PostgreSQL نیز الزام شوند؟',
    options: [
      'اعتبارسنجی فقط در Application',
      'کلیدهای ساده بدون Organization',
      'Unique و Foreign Key مرکب سازمانی همراه اعتبارسنجی Application',
    ],
    evidence: [
      'بررسی Catalog محدودیت‌های Outbox، Inbox و Heartbeat',
      'آزمون واقعی رد Duplicate در یک سازمان',
      'آزمون پذیرش همان شناسه منطقی در دو سازمان مستقل',
    ],
    limitations: ['جداول دامنه P2 تا P9 هنوز ساخته نشده‌اند'],
    decision: {
      status: 'accept',
      text: 'مرز سازمان باید در Unique و Foreign Keyهای دامنه وارد شود و Application تنها لایه دوم اعتبارسنجی باشد.',
    },
    technicalDebt: ['الگوی Composite FK باید در Migrationهای دامنه به آزمون بازگشتی تبدیل شود'],
    classification: 'spike-only',
  },
] as const satisfies readonly TechnicalSpikeRecord[];
