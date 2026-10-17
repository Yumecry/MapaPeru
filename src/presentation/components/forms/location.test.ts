import { describe, expect, it } from 'vitest';
import { isInsidePeru, roundCoordinate, toPeruCoordinates } from './location';

describe('roundCoordinate', () => {
  it('redondea a 6 decimales', () => {
    expect(roundCoordinate(-13.123456789)).toBe(-13.123457);
    expect(roundCoordinate(-72.1)).toBe(-72.1);
  });
});

describe('isInsidePeru', () => {
  it('acepta bordes y rechaza puntos fuera del bbox', () => {
    expect(isInsidePeru({ latitude: -18.5, longitude: -81.4 })).toBe(true);
    expect(isInsidePeru({ latitude: 0, longitude: -68.6 })).toBe(true);
    expect(isInsidePeru({ latitude: 0.01, longitude: -75 })).toBe(false);
    expect(isInsidePeru({ latitude: -12, longitude: -68.59 })).toBe(false);
  });
});

describe('toPeruCoordinates', () => {
  it('redondea puntos dentro del Perú sin moverlos', () => {
    expect(toPeruCoordinates({ latitude: -13.31234567, longitude: -72.11234567 })).toEqual({
      latitude: -13.312346,
      longitude: -72.112346,
    });
  });

  it('ajusta al borde los puntos fuera del bbox', () => {
    expect(toPeruCoordinates({ latitude: 2, longitude: -90 })).toEqual({
      latitude: 0,
      longitude: -81.4,
    });
    expect(toPeruCoordinates({ latitude: -25, longitude: -60 })).toEqual({
      latitude: -18.5,
      longitude: -68.6,
    });
  });
});
