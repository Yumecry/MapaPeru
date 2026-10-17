import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NasaFirmsAdapter,
  buildFirmsUrl,
  isFirmsCsvHeader,
  parseCsv,
} from './nasa-firms.adapter';

const API_KEY = 'secretkey123';

const HEADER =
  'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight';

function row(overrides: { confidence?: string; frp?: number; lat?: number } = {}): string {
  const { confidence = 'n', frp = 12.5, lat = -12.5 } = overrides;
  return `${lat},-75.1,330.1,0.4,0.37,2026-10-15,0612,N20,VIIRS,${confidence},2.0NRT,290.2,${frp},N`;
}

function csvResponse(body: string, status = 200, statusText = 'OK'): Response {
  return new Response(body, { status, statusText });
}

describe('parseCsv', () => {
  it('convierte filas en registros usando la cabecera', () => {
    expect(parseCsv('a,b\n1,2\n3,4')).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('respeta comas dentro de comillas', () => {
    expect(parseCsv('a,b\n"x,y",2')).toEqual([{ a: 'x,y', b: '2' }]);
  });

  it('interpreta "" como comilla escapada', () => {
    expect(parseCsv('a,b\n"dice ""hola""",2')).toEqual([{ a: 'dice "hola"', b: '2' }]);
  });

  it('admite saltos de línea CRLF', () => {
    expect(parseCsv('a,b\r\n1,2\r\n3,4\r\n')).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('ignora líneas vacías', () => {
    expect(parseCsv('a,b\n\n1,2\n\n\n3,4\n')).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('recorta espacios en cabeceras y valores', () => {
    expect(parseCsv(' a , b \n 1 , 2 ')).toEqual([{ a: '1', b: '2' }]);
  });

  it('rellena con cadena vacía las columnas faltantes', () => {
    expect(parseCsv('a,b,c\n1,2')).toEqual([{ a: '1', b: '2', c: '' }]);
  });

  it('devuelve [] con menos de 2 filas', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('a,b')).toEqual([]);
    expect(parseCsv('a,b\n\n')).toEqual([]);
  });
});

describe('buildFirmsUrl', () => {
  it('usa el formato /api/area/csv/{KEY}/{SOURCE}/{bbox}/{days}', () => {
    const url = buildFirmsUrl(API_KEY, 'VIIRS_NOAA20_NRT', 2, '-81.4,-18.5,-68.6,0.0');
    expect(url).toBe(
      `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${API_KEY}/VIIRS_NOAA20_NRT/-81.4,-18.5,-68.6,0.0/2`,
    );
  });

  it('usa el bbox de Perú por defecto', () => {
    expect(buildFirmsUrl(API_KEY, 'VIIRS_NOAA21_NRT', 1)).toBe(
      `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${API_KEY}/VIIRS_NOAA21_NRT/-81.4,-18.5,-68.6,0.0/1`,
    );
  });

  it('no envía la key en la query string', () => {
    const url = new URL(buildFirmsUrl(API_KEY, 'VIIRS_NOAA20_NRT', 1));
    expect(url.search).toBe('');
    expect(url.searchParams.has('MAP_KEY')).toBe(false);
  });

  it('codifica la key como segmento de ruta', () => {
    const url = buildFirmsUrl('a/b?c', 'VIIRS_NOAA20_NRT', 1);
    expect(url).toContain('/csv/a%2Fb%3Fc/VIIRS_NOAA20_NRT/');
  });

  it.each([0, 6, 1.5, -1, Number.NaN])('lanza con dayRange inválido (%s)', (days) => {
    expect(() => buildFirmsUrl(API_KEY, 'VIIRS_NOAA20_NRT', days)).toThrow(/dayRange/);
  });

  it.each([1, 5])('acepta dayRange en el límite (%s)', (days) => {
    expect(buildFirmsUrl(API_KEY, 'VIIRS_NOAA20_NRT', days)).toMatch(new RegExp(`/${days}$`));
  });
});

describe('isFirmsCsvHeader', () => {
  it('reconoce la cabecera de FIRMS', () => {
    expect(isFirmsCsvHeader(`${HEADER}\n${row()}`)).toBe(true);
  });

  it('tolera espacios iniciales y mayúsculas', () => {
    expect(isFirmsCsvHeader('\n  LATITUDE,LONGITUDE\r\n1,2')).toBe(true);
  });

  it('rechaza mensajes de error de texto plano', () => {
    expect(isFirmsCsvHeader('Invalid MAP_KEY.')).toBe(false);
    expect(isFirmsCsvHeader('')).toBe(false);
  });

  it('solo mira la primera línea', () => {
    expect(isFirmsCsvHeader('Error\nlatitude,longitude')).toBe(false);
  });
});

describe('NasaFirmsAdapter.getActive', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(...responses: Response[]) {
    const fetchMock = vi.fn<typeof fetch>();
    for (const response of responses) fetchMock.mockResolvedValueOnce(response);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('lanza si no hay API key', () => {
    vi.stubEnv('NASA_FIRMS_API_KEY', '');
    expect(() => new NasaFirmsAdapter()).toThrow(/NASA_FIRMS_API_KEY/);
  });

  it('pide la URL con la key en la ruta, una vez por fuente', async () => {
    const fetchMock = stubFetch(csvResponse(`${HEADER}\n${row()}`), csvResponse(HEADER));
    const adapter = new NasaFirmsAdapter({ apiKey: API_KEY });

    const hotspots = await adapter.getActive();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toBe(buildFirmsUrl(API_KEY, 'VIIRS_NOAA20_NRT', 1));
    expect(String(fetchMock.mock.calls[1][0])).toBe(buildFirmsUrl(API_KEY, 'VIIRS_NOAA21_NRT', 1));
    expect(hotspots).toHaveLength(1);
    expect(hotspots[0].properties).toMatchObject({
      latitude: -12.5,
      longitude: -75.1,
      frp: 12.5,
      confidence: 'n',
      source: 'VIIRS_NOAA20_NRT',
      satellite: 'NOAA-20',
      acquisitionDate: '2026-10-15T06:12:00Z',
    });
  });

  it('ante un HTTP 400 lanza un error sin la URL ni la key', async () => {
    stubFetch(csvResponse('Bad Request', 400, 'Bad Request'));
    const adapter = new NasaFirmsAdapter({ apiKey: API_KEY, sources: ['VIIRS_NOAA20_NRT'] });

    const error = await adapter.getActive().then(
      () => null,
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('400');
    expect(message).not.toContain(API_KEY);
    expect(message).not.toContain('https://');
  });

  it('ante un 200 con "Invalid MAP_KEY." lanza error de respuesta no CSV', async () => {
    stubFetch(csvResponse('Invalid MAP_KEY.'));
    const adapter = new NasaFirmsAdapter({ apiKey: API_KEY, sources: ['VIIRS_NOAA20_NRT'] });

    await expect(adapter.getActive()).rejects.toThrow(/no CSV/);
  });

  it('enmascara la key si aparece en el cuerpo no CSV', async () => {
    stubFetch(csvResponse(`Clave ${API_KEY} inválida`));
    const adapter = new NasaFirmsAdapter({ apiKey: API_KEY, sources: ['VIIRS_NOAA20_NRT'] });

    const error = await adapter.getActive().catch((err: unknown) => err);
    expect((error as Error).message).not.toContain(API_KEY);
    expect((error as Error).message).toContain('***');
  });

  it("descarta los focos con confidence 'l'", async () => {
    stubFetch(
      csvResponse(
        [HEADER, row({ confidence: 'l', lat: -10 }), row({ confidence: 'h', lat: -11 }), row({ lat: -12 })].join(
          '\n',
        ),
      ),
    );
    const adapter = new NasaFirmsAdapter({ apiKey: API_KEY, sources: ['VIIRS_NOAA20_NRT'] });

    const hotspots = await adapter.getActive();

    expect(hotspots.map((h) => h.confidence)).toEqual(['h', 'n']);
    expect(hotspots.map((h) => h.properties.latitude)).toEqual([-11, -12]);
  });

  it('descarta filas que no cumplen el esquema', async () => {
    stubFetch(csvResponse([HEADER, row(), 'basura,1,2'].join('\n')));
    const adapter = new NasaFirmsAdapter({ apiKey: API_KEY, sources: ['VIIRS_NOAA20_NRT'] });

    expect(await adapter.getActive()).toHaveLength(1);
  });

  it('aplica el filtro minFrp (inclusivo)', async () => {
    stubFetch(
      csvResponse(
        [HEADER, row({ frp: 5, lat: -10 }), row({ frp: 20, lat: -11 }), row({ frp: 50, lat: -12 })].join(
          '\n',
        ),
      ),
    );
    const adapter = new NasaFirmsAdapter({ apiKey: API_KEY, sources: ['VIIRS_NOAA20_NRT'] });

    const hotspots = await adapter.getActive({ minFrp: 20 });

    expect(hotspots.map((h) => h.frp)).toEqual([20, 50]);
  });
});
