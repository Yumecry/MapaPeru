import type { LogisticsRequest } from '@/domain/entities/logistics-request.entity';
import type { PublicLogisticsView } from '@/application/dto/logistics-geojson';

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
