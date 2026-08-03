export type SpikeDecision = 'accept' | 'reject' | 'defer';

export interface OutboxMessageInput {
  readonly messageId: string;
  readonly organizationId: string;
  readonly idempotencyKey: string;
}

interface OutboxMessageState extends OutboxMessageInput {
  readonly deliveredTo: Set<string>;
  leaseOwner: string | undefined;
  leaseExpiresAt: number | undefined;
}

export type EnqueueResult =
  | { readonly status: 'created'; readonly messageId: string }
  | { readonly status: 'duplicate'; readonly messageId: string };

export type ClaimResult =
  | { readonly status: 'claimed'; readonly owner: string }
  | { readonly status: 'busy'; readonly owner: string }
  | { readonly status: 'missing' };

export type DeliveryResult = 'processed' | 'duplicate';

function normalized(value: string, label: string): string {
  const result = value.trim();

  if (result === '') {
    throw new TypeError(`${label} نباید خالی باشد.`);
  }

  return result;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${label} باید عدد صحیح مثبت باشد.`);
  }

  return value;
}

export class OutboxLeaseModel {
  private readonly messages = new Map<string, OutboxMessageState>();
  private readonly idempotencyIndex = new Map<string, string>();

  public enqueue(input: OutboxMessageInput): EnqueueResult {
    const messageId = normalized(input.messageId, 'شناسه پیام');
    const organizationId = normalized(input.organizationId, 'شناسه سازمان');
    const idempotencyKey = normalized(input.idempotencyKey, 'کلید هم‌کنشی امن');
    const identity = `${organizationId}\u0000${idempotencyKey}`;
    const existingMessageId = this.idempotencyIndex.get(identity);

    if (existingMessageId !== undefined) {
      return {
        status: 'duplicate',
        messageId: existingMessageId,
      };
    }

    if (this.messages.has(messageId)) {
      throw new TypeError('شناسه پیام تکراری است.');
    }

    this.messages.set(messageId, {
      messageId,
      organizationId,
      idempotencyKey,
      deliveredTo: new Set<string>(),
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
    });
    this.idempotencyIndex.set(identity, messageId);

    return { status: 'created', messageId };
  }

  public claim(
    messageIdValue: string,
    ownerValue: string,
    nowMilliseconds: number,
    leaseMillisecondsValue: number,
  ): ClaimResult {
    const messageId = normalized(messageIdValue, 'شناسه پیام');
    const owner = normalized(ownerValue, 'مالک Lease');
    const leaseMilliseconds = positiveInteger(leaseMillisecondsValue, 'مدت Lease');
    const state = this.messages.get(messageId);

    if (state === undefined) {
      return { status: 'missing' };
    }

    if (
      state.leaseOwner !== undefined &&
      state.leaseExpiresAt !== undefined &&
      state.leaseExpiresAt > nowMilliseconds
    ) {
      return { status: 'busy', owner: state.leaseOwner };
    }

    state.leaseOwner = owner;
    state.leaseExpiresAt = nowMilliseconds + leaseMilliseconds;

    return { status: 'claimed', owner };
  }

  public complete(
    messageIdValue: string,
    ownerValue: string,
    consumerValue: string,
    deliveryIdValue: string,
    nowMilliseconds: number,
  ): DeliveryResult {
    const messageId = normalized(messageIdValue, 'شناسه پیام');
    const owner = normalized(ownerValue, 'مالک Lease');
    const consumer = normalized(consumerValue, 'نام Consumer');
    const deliveryId = normalized(deliveryIdValue, 'شناسه تحویل');
    const state = this.messages.get(messageId);

    if (state === undefined) {
      throw new TypeError('پیام Outbox پیدا نشد.');
    }

    if (
      state.leaseOwner !== owner ||
      state.leaseExpiresAt === undefined ||
      state.leaseExpiresAt <= nowMilliseconds
    ) {
      throw new Error('Lease معتبر برای تکمیل تحویل وجود ندارد.');
    }

    const deliveryIdentity = `${consumer}\u0000${deliveryId}`;

    if (state.deliveredTo.has(deliveryIdentity)) {
      return 'duplicate';
    }

    state.deliveredTo.add(deliveryIdentity);
    return 'processed';
  }

  public deliveryCount(messageIdValue: string): number {
    const messageId = normalized(messageIdValue, 'شناسه پیام');
    return this.messages.get(messageId)?.deliveredTo.size ?? 0;
  }
}

export interface SessionOrganizationContext {
  readonly sessionRevision: string;
  readonly subjectId: string;
  readonly organizationId: string;
}

export class OrganizationSessionCache<Value> {
  private context: SessionOrganizationContext | undefined;
  private readonly values = new Map<string, Value>();

  public activate(context: SessionOrganizationContext): void {
    const normalizedContext: SessionOrganizationContext = {
      sessionRevision: normalized(context.sessionRevision, 'نسخه نشست'),
      subjectId: normalized(context.subjectId, 'شناسه کاربر'),
      organizationId: normalized(context.organizationId, 'شناسه سازمان جاری'),
    };

    if (
      this.context === undefined ||
      this.context.sessionRevision !== normalizedContext.sessionRevision ||
      this.context.subjectId !== normalizedContext.subjectId ||
      this.context.organizationId !== normalizedContext.organizationId
    ) {
      this.values.clear();
    }

    this.context = normalizedContext;
  }

  public write(resourceValue: string, value: Value): void {
    this.values.set(this.key(resourceValue), value);
  }

  public read(resourceValue: string): Value | undefined {
    return this.values.get(this.key(resourceValue));
  }

  public size(): number {
    return this.values.size;
  }

  private key(resourceValue: string): string {
    const context = this.context;

    if (context === undefined) {
      throw new Error('زمینه نشست و سازمان فعال نیست.');
    }

    const resource = normalized(resourceValue, 'کلید منبع');
    return [context.sessionRevision, context.subjectId, context.organizationId, resource].join(
      '\u0000',
    );
  }
}

interface PoolSlot {
  readonly id: number;
  organizationId: string | undefined;
  busy: boolean;
}

export class TransactionContextPoolModel {
  private readonly slots: PoolSlot[];

  public constructor(sizeValue: number) {
    const size = positiveInteger(sizeValue, 'اندازه Pool');
    this.slots = Array.from({ length: size }, (_value, index) => ({
      id: index + 1,
      organizationId: undefined,
      busy: false,
    }));
  }

  public async run<Result>(
    organizationIdValue: string,
    operation: (context: {
      readonly connectionId: number;
      readonly organizationId: string;
    }) => Result | Promise<Result>,
  ): Promise<Result> {
    const organizationId = normalized(organizationIdValue, 'شناسه سازمان');
    const slot = this.slots.find((candidate) => !candidate.busy);

    if (slot === undefined) {
      throw new Error('اتصال آزاد در Pool وجود ندارد.');
    }

    slot.busy = true;
    slot.organizationId = organizationId;

    try {
      return await operation({
        connectionId: slot.id,
        organizationId,
      });
    } finally {
      slot.organizationId = undefined;
      slot.busy = false;
    }
  }

  public inspect(): readonly Readonly<PoolSlot>[] {
    return this.slots.map((slot) => ({ ...slot }));
  }
}

export function compositeIdentity(...parts: readonly string[]): string {
  if (parts.length < 2) {
    throw new RangeError('هویت مرکب حداقل دو جزء لازم دارد.');
  }

  return parts.map((part, index) => normalized(part, `جزء ${String(index + 1)}`)).join('\u0000');
}
