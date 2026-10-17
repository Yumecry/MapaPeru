import { Hotspot } from '@/domain/entities/hotspot.entity';
import type { HotspotProperties } from '@/domain/types';
import type { IHotspotProvider } from '@/domain/providers/hotspot.provider';
import { z } from 'zod';

const FIRMS_CSV_ROW_SCHEMA = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  bright_ti4: z.coerce.number(),
  scan: z.coerce.number().positive(),
  track: z.coerce.number().positive(),
  acq_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  acq_time: z.string().regex(/^\d{4}$/),
  instrument: z.literal('VIIRS'),
  confidence: z.enum(['l', 'n', 'h']),
  version: z.string().min(1),
  bright_ti5: z.coerce.number(),
  frp: z.coerce.number().nonnegative(),
  daynight: z.enum(['D', 'N']),
});

type FirmsCsvRow = z.infer<typeof FIRMS_CSV_ROW_SCHEMA>;

const PERU_BBOX = '-81.4,-18.5,-68.6,0.0';
const FIRMS_BASE_URL = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';

export type FirmsSource = 'VIIRS_NOAA20_NRT' | 'VIIRS_NOAA21_NRT';

const MIN_DAY_RANGE = 1;
const MAX_DAY_RANGE = 5;

interface NasaFirmsConfig {
  apiKey: string;
  sources: FirmsSource[];
  dayRange: number;
}

export function buildFirmsUrl(
  apiKey: string,
  source: FirmsSource,
  dayRange: number,
  bbox: string = PERU_BBOX,
): string {
  if (!Number.isInteger(dayRange) || dayRange < MIN_DAY_RANGE || dayRange > MAX_DAY_RANGE) {
    throw new Error(`dayRange debe ser un entero entre ${MIN_DAY_RANGE} y ${MAX_DAY_RANGE}`);
  }
  return `${FIRMS_BASE_URL}/${encodeURIComponent(apiKey)}/${source}/${bbox}/${dayRange}`;
}

export function isFirmsCsvHeader(csvText: string): boolean {
  const firstLine = csvText.trimStart().split(/\r?\n/, 1)[0] ?? '';
  return firstLine.toLowerCase().includes('latitude');
}

export function parseCsv(csvText: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && nextChar === '\n') i++;
        currentRow.push(currentField);
        if (currentRow.length > 1 || currentRow[0] !== '') {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.length > 1 || currentRow[0] !== '') {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map((h: string) => h.trim());
  return rows.slice(1).map((row: string[]) => {
    const record: Record<string, string> = {};
    headers.forEach((header: string, index: number) => {
      record[header] = (row[index] ?? '').trim();
    });
    return record;
  });
}

function rowToHotspotProperties(
  row: FirmsCsvRow,
  source: FirmsSource,
): HotspotProperties {
  const satellite = source === 'VIIRS_NOAA20_NRT' ? 'NOAA-20' : 'NOAA-21';
  const id = `${satellite}-${row.acq_date}-${row.acq_time}-${row.latitude.toFixed(4)}-${row.longitude.toFixed(4)}`;

  return {
    id,
    latitude: row.latitude,
    longitude: row.longitude,
    frp: row.frp,
    confidence: row.confidence === 'h' ? 'h' : 'n',
    source,
    acquisitionDate: `${row.acq_date}T${row.acq_time.slice(0, 2)}:${row.acq_time.slice(2)}:00Z`,
    brightness: row.bright_ti4,
    scan: row.scan,
    track: row.track,
    satellite,
  };
}

export class NasaFirmsAdapter implements IHotspotProvider {
  private readonly config: NasaFirmsConfig;

  constructor(config: Partial<NasaFirmsConfig> = {}) {
    const apiKey = config.apiKey ?? process.env.NASA_FIRMS_API_KEY ?? '';
    if (!apiKey) {
      throw new Error('NASA_FIRMS_API_KEY es requerido');
    }
    this.config = {
      apiKey,
      sources: config.sources ?? ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'],
      dayRange: config.dayRange ?? 1,
    };
  }

  async fetchRecent(): Promise<Hotspot[]> {
    const allHotspots: Hotspot[] = [];

    for (const source of this.config.sources) {
      const csvText = await this.fetchCsv(source);
      const rows = parseCsv(csvText);

      for (const rawRow of rows) {
        const parsed = FIRMS_CSV_ROW_SCHEMA.safeParse(rawRow);
        if (!parsed.success) continue;

        if (parsed.data.confidence === 'l') continue;

        allHotspots.push(Hotspot.create(rowToHotspotProperties(parsed.data, source)));
      }
    }

    return allHotspots;
  }

  private async fetchCsv(source: FirmsSource): Promise<string> {
    const url = buildFirmsUrl(this.config.apiKey, source, this.config.dayRange);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(
        `NASA FIRMS API error: ${response.status} ${response.statusText} para ${source}`,
      );
    }

    const text = await response.text();
    if (!isFirmsCsvHeader(text)) {
      const snippet = (text.trim().split(/\r?\n/, 1)[0] ?? '')
        .split(this.config.apiKey)
        .join('***')
        .slice(0, 120);
      throw new Error(
        `NASA FIRMS API devolvió una respuesta no CSV para ${source}: ${snippet || '(vacía)'}`,
      );
    }
    return text;
  }
}
