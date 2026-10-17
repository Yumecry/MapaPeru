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
  isVerified: VerifyStatus;
  createdAt: string;
  updatedAt: string;
}

export class LogisticsRequest {
  readonly id: string;
  readonly contact: LogisticsContact;
  readonly latitude: number;
  readonly longitude: number;
  readonly categories: readonly SupplyCategory[];
  readonly urgency: UrgencyLevel;
  readonly description: string;
  readonly isVerified: VerifyStatus;
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
    this.isVerified = primitives.isVerified;
    this.createdAt = primitives.createdAt;
    this.updatedAt = primitives.updatedAt;
  }

  static fromPrimitives(primitives: LogisticsRequestPrimitives): LogisticsRequest {
    return new LogisticsRequest(primitives);
  }

  static create(
    data: Omit<LogisticsRequestPrimitives, 'id' | 'isVerified' | 'createdAt' | 'updatedAt'>,
  ): LogisticsRequest {
    const now = new Date().toISOString();
    return new LogisticsRequest({
      ...data,
      id: crypto.randomUUID(),
      isVerified: 'pendiente',
      createdAt: now,
      updatedAt: now,
    });
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
