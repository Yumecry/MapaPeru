import { describe, expect, it } from 'vitest';
import { LogisticsRequest } from '@/domain/entities/logistics-request.entity';
import { toPublicLogisticsView } from './public-logistics-view.mapper';
import { logisticsToGeoJSON } from './logistics-geojson.mapper';

const TEAM_PHONE = '51912345678';
const REQUESTER_PHONE = '987654321';
const FULL_NAME = 'Juan Mamani';
const DESCRIPTION = 'Descripción privada con detalles sensibles';

function buildRequest(): LogisticsRequest {
  return LogisticsRequest.fromPrimitives({
    id: '0b6f1c1e-5b9a-4a8e-9a43-2b7c5f0e9d11',
    contact: {
      fullName: FULL_NAME,
      phone: REQUESTER_PHONE,
      region: 'Puno',
      district: 'Juliaca',
    },
    latitude: -15.5,
    longitude: -70.13,
    categories: ['agua', 'veterinaria'],
    urgency: 'moderado',
    description: DESCRIPTION,
    isVerified: 'verificado',
    createdAt: '2026-10-15T12:00:00.000Z',
    updatedAt: '2026-10-15T12:00:00.000Z',
  });
}

const PUBLIC_KEYS = ['categories', 'createdAt', 'district', 'id', 'region', 'urgency', 'whatsAppLink'];

describe('toPublicLogisticsView', () => {
  it('expone exactamente las claves públicas', () => {
    const view = toPublicLogisticsView(buildRequest(), TEAM_PHONE);
    expect(Object.keys(view).sort()).toEqual(PUBLIC_KEYS);
  });

  it('no incluye fullName, phone ni description', () => {
    const view = toPublicLogisticsView(buildRequest(), TEAM_PHONE) as unknown as Record<
      string,
      unknown
    >;
    expect(view).not.toHaveProperty('fullName');
    expect(view).not.toHaveProperty('phone');
    expect(view).not.toHaveProperty('description');
    expect(view).not.toHaveProperty('contact');
  });

  it('el JSON serializado no contiene teléfono, nombre ni descripción', () => {
    const json = JSON.stringify(toPublicLogisticsView(buildRequest(), TEAM_PHONE));
    expect(json).not.toContain(REQUESTER_PHONE);
    expect(json).not.toContain(FULL_NAME);
    expect(json).not.toContain(DESCRIPTION);
  });

  it('el enlace de WhatsApp apunta al equipo', () => {
    const view = toPublicLogisticsView(buildRequest(), TEAM_PHONE);
    expect(view.whatsAppLink.startsWith(`https://wa.me/${TEAM_PHONE}?`)).toBe(true);
  });

  it('copia las categorías (no comparte la referencia congelada)', () => {
    const request = buildRequest();
    const view = toPublicLogisticsView(request, TEAM_PHONE);
    expect(view.categories).toEqual(['agua', 'veterinaria']);
    expect(view.categories).not.toBe(request.categories);
  });
});

describe('logisticsToGeoJSON', () => {
  it('genera una FeatureCollection con coordenadas [lng, lat]', () => {
    const collection = logisticsToGeoJSON([buildRequest()], TEAM_PHONE);
    expect(collection.type).toBe('FeatureCollection');
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0].type).toBe('Feature');
    expect(collection.features[0].geometry).toEqual({
      type: 'Point',
      coordinates: [-70.13, -15.5],
    });
  });

  it('las propiedades tienen exactamente las claves públicas', () => {
    const [feature] = logisticsToGeoJSON([buildRequest()], TEAM_PHONE).features;
    expect(Object.keys(feature).sort()).toEqual(['geometry', 'properties', 'type']);
    expect(Object.keys(feature.properties).sort()).toEqual(PUBLIC_KEYS);
  });

  it('el JSON serializado no contiene teléfono, nombre ni descripción', () => {
    const json = JSON.stringify(logisticsToGeoJSON([buildRequest(), buildRequest()], TEAM_PHONE));
    expect(json).not.toContain(REQUESTER_PHONE);
    expect(json).not.toContain(FULL_NAME);
    expect(json).not.toContain(DESCRIPTION);
  });

  it('devuelve una colección vacía sin solicitudes', () => {
    expect(logisticsToGeoJSON([], TEAM_PHONE)).toEqual({ type: 'FeatureCollection', features: [] });
  });
});
