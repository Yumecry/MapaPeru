import type { LogisticsRequest } from '@/domain/entities/logistics-request.entity';
import type { SupplyCategory, UrgencyLevel } from '@/domain/types';

export interface PublicLogisticsView {
  id: string;
  region: string;
  district: string;
  urgency: UrgencyLevel;
  categories: SupplyCategory[];
  whatsAppLink: string;
  createdAt: string;
}

export function toPublicLogisticsView(
  request: LogisticsRequest,
  teamPhone: string,
): PublicLogisticsView {
  return {
    id: request.id,
    region: request.contact.region,
    district: request.contact.district,
    urgency: request.urgency,
    categories: [...request.categories],
    whatsAppLink: request.toWhatsAppDeepLink(teamPhone),
    createdAt: request.createdAt,
  };
}
