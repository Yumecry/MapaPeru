import type {
  LogisticsContact,
  SupplyCategory,
  UrgencyLevel,
  VerifyStatus,
} from '../types';

export interface LogisticsRequestPrimitives {
  id: string;
  contact: LogisticsContact;
  latitude: number;
  longitude: number;
  categories: SupplyCategory[];
  urgency: UrgencyLevel;
  description: string;
  status: VerifyStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export class InvalidStatusTransitionError extends Error {
  constructor(
    readonly from: VerifyStatus,
    readonly to: VerifyStatus,
  ) {
    super(`Transición de estado no permitida: ${from} → ${to}`);
    this.name = 'InvalidStatusTransitionError';
  }
}

export class LogisticsRequest {
  readonly id: string;
  readonly contact: LogisticsContact;
  readonly latitude: number;
  readonly longitude: number;
  readonly categories: readonly SupplyCategory[];
  readonly urgency: UrgencyLevel;
  readonly description: string;
  readonly status: VerifyStatus;
  readonly verifiedBy?: string;
  readonly verifiedAt?: string;
  readonly rejectionReason?: string;
  readonly createdAt: string;
  readonly updatedAt: string;

  private constructor(primitives: LogisticsRequestPrimitives) {
    this.id = primitives.id;
    this.contact = Object.freeze({ ...primitives.contact });
    this.latitude = primitives.latitude;
    this.longitude = primitives.longitude;
    this.categories = Object.freeze([...primitives.categories]);
    this.urgency = primitives.urgency;
    this.description = primitives.description;
    this.status = primitives.status;
    this.verifiedBy = primitives.verifiedBy;
    this.verifiedAt = primitives.verifiedAt;
    this.rejectionReason = primitives.rejectionReason;
    this.createdAt = primitives.createdAt;
    this.updatedAt = primitives.updatedAt;
  }

  static fromPrimitives(primitives: LogisticsRequestPrimitives): LogisticsRequest {
    return new LogisticsRequest(primitives);
  }

  static create(
    data: Omit<
      LogisticsRequestPrimitives,
      'id' | 'status' | 'verifiedBy' | 'verifiedAt' | 'rejectionReason' | 'createdAt' | 'updatedAt'
    >,
  ): LogisticsRequest {
    const now = new Date().toISOString();
    return new LogisticsRequest({
      ...data,
      id: crypto.randomUUID(),
      status: 'pendiente',
      createdAt: now,
      updatedAt: now,
    });
  }

  toPrimitives(): LogisticsRequestPrimitives {
    return {
      id: this.id,
      contact: { ...this.contact },
      latitude: this.latitude,
      longitude: this.longitude,
      categories: [...this.categories],
      urgency: this.urgency,
      description: this.description,
      status: this.status,
      verifiedBy: this.verifiedBy,
      verifiedAt: this.verifiedAt,
      rejectionReason: this.rejectionReason,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  verify(verifierId: string, now: Date): LogisticsRequest {
    this.assertPending('verificado');
    const at = now.toISOString();
    return new LogisticsRequest({
      ...this.toPrimitives(),
      status: 'verificado',
      verifiedBy: requireVerifierId(verifierId),
      verifiedAt: at,
      rejectionReason: undefined,
      updatedAt: at,
    });
  }

  reject(verifierId: string, reason: string, now: Date): LogisticsRequest {
    this.assertPending('rechazado');
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      throw new Error('El motivo del rechazo es obligatorio');
    }
    const at = now.toISOString();
    return new LogisticsRequest({
      ...this.toPrimitives(),
      status: 'rechazado',
      verifiedBy: requireVerifierId(verifierId),
      verifiedAt: at,
      rejectionReason: trimmed,
      updatedAt: at,
    });
  }

  private assertPending(to: VerifyStatus): void {
    if (this.status !== 'pendiente') {
      throw new InvalidStatusTransitionError(this.status, to);
    }
  }

  toWhatsAppDeepLink(teamPhone: string): string {
    const digits = teamPhone.replace(/\D/g, '');
    if (digits.length === 0) {
      throw new Error('Número de WhatsApp del equipo inválido');
    }
    const message = encodeURIComponent(
      `Hola, solicito verificación de mi reporte de ayuda humanitaria ID: ${this.id} (Urgencia: ${this.urgency}, Región/Distrito: ${this.contact.region}/${this.contact.district}).`,
    );
    return `https://wa.me/${digits}?text=${message}`;
  }
}

function requireVerifierId(verifierId: string): string {
  if (verifierId.trim().length === 0) {
    throw new Error('Identificador de verificador inválido');
  }
  return verifierId;
}
