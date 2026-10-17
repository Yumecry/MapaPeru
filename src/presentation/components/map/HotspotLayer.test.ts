// @vitest-environment jsdom
// HotspotLayer importa react-leaflet/leaflet, que requieren `window` al cargarse.
import { describe, expect, it } from 'vitest';
import { getFrpStyle } from './HotspotLayer';

describe('getFrpStyle', () => {
  it.each([
    [0, '#65a30d'],
    [9.9, '#65a30d'],
    [10, '#f59e0b'],
    [29.9, '#f59e0b'],
    [30, '#ea580c'],
    [59.9, '#ea580c'],
    [60, '#dc2626'],
    [500, '#dc2626'],
  ])('FRP %s MW → color %s', (frp, color) => {
    expect(getFrpStyle(frp).color).toBe(color);
  });

  it('agrupa los umbrales 9.9/10/29.9/30/59.9/60 en tramos distintos', () => {
    expect(getFrpStyle(9.9)).not.toEqual(getFrpStyle(10));
    expect(getFrpStyle(29.9)).not.toEqual(getFrpStyle(30));
    expect(getFrpStyle(59.9)).not.toEqual(getFrpStyle(60));
  });

  it('el radio crece estrictamente con la intensidad', () => {
    const radii = [5, 15, 45, 100].map((frp) => getFrpStyle(frp).radius);
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i]).toBeGreaterThan(radii[i - 1]);
    }
  });

  it('>60 MW usa el color más grave (rojo), no ámbar', () => {
    expect(getFrpStyle(61).color).toBe('#dc2626');
  });
});
