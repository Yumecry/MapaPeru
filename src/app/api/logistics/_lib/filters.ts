import { z } from 'zod';
import type { VerifiedRequestFilters } from '@/domain/repositories/logistics.repository';
import {
  supplyCategorySchema,
  urgencyLevelSchema,
} from '@/application/schemas/logistics-request.schema';

export type FiltersResult =
  | { ok: true; filters: VerifiedRequestFilters }
  | { ok: false; error: string };

export function parseVerifiedFilters(searchParams: URLSearchParams): FiltersResult {
  const region = searchParams.get('region')?.trim() || undefined;
  const urgencyParam = searchParams.get('urgency');
  const categoriesParam = searchParams.get('categories');

  let urgency: VerifiedRequestFilters['urgency'];
  if (urgencyParam !== null && urgencyParam !== '') {
    const parsed = urgencyLevelSchema.safeParse(urgencyParam);
    if (!parsed.success) return { ok: false, error: 'urgency inválido' };
    urgency = parsed.data;
  }

  let categories: VerifiedRequestFilters['categories'];
  if (categoriesParam !== null && categoriesParam !== '') {
    const raw = categoriesParam.split(',').map((c) => c.trim()).filter(Boolean);
    const parsed = z.array(supplyCategorySchema).safeParse(raw);
    if (!parsed.success) return { ok: false, error: 'categories inválidas' };
    categories = parsed.data;
  }

  return { ok: true, filters: { region, urgency, categories } };
}
