import { describe, expect, it } from 'vitest';
import { parseVerifiedFilters } from './filters';

function parse(query: string) {
  return parseVerifiedFilters(new URLSearchParams(query));
}

describe('parseVerifiedFilters', () => {
  it('sin parámetros devuelve filtros vacíos', () => {
    expect(parse('')).toEqual({
      ok: true,
      filters: { region: undefined, urgency: undefined, categories: undefined },
    });
  });

  it('recorta region y la ignora si queda vacía', () => {
    expect(parse('region=%20Cusco%20')).toMatchObject({ ok: true, filters: { region: 'Cusco' } });
    expect(parse('region=%20%20')).toMatchObject({ ok: true, filters: { region: undefined } });
  });

  it('acepta una urgencia válida', () => {
    expect(parse('urgency=critico')).toMatchObject({ ok: true, filters: { urgency: 'critico' } });
  });

  it('ignora urgency vacía', () => {
    expect(parse('urgency=')).toMatchObject({ ok: true, filters: { urgency: undefined } });
  });

  it('rechaza una urgencia desconocida', () => {
    expect(parse('urgency=alta')).toEqual({ ok: false, error: 'urgency inválido' });
  });

  it('separa categorías por comas, recortando y omitiendo vacías', () => {
    expect(parse('categories=agua,%20colirios%20,,')).toMatchObject({
      ok: true,
      filters: { categories: ['agua', 'colirios'] },
    });
  });

  it('ignora categories vacío', () => {
    expect(parse('categories=')).toMatchObject({ ok: true, filters: { categories: undefined } });
  });

  it('rechaza categorías desconocidas', () => {
    expect(parse('categories=agua,comida')).toEqual({ ok: false, error: 'categories inválidas' });
  });

  it('combina todos los filtros', () => {
    expect(parse('region=Puno&urgency=moderado&categories=veterinaria')).toEqual({
      ok: true,
      filters: { region: 'Puno', urgency: 'moderado', categories: ['veterinaria'] },
    });
  });
});
