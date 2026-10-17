import { z } from 'zod';

export const urgencyLevelSchema = z.enum(['critico', 'moderado', 'cubierto']);

export const supplyCategorySchema = z.enum([
  'agua',
  'colirios',
  'herramientas',
  'veterinaria',
]);

// Mismo bbox que el adaptador FIRMS (oeste, sur, este, norte).
export const PERU_BOUNDS = {
  minLatitude: -18.5,
  maxLatitude: 0.0,
  minLongitude: -81.4,
  maxLongitude: -68.6,
} as const;

const OUTSIDE_PERU = 'La ubicación debe estar dentro del Perú';

export const logisticsRequestSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(80, 'El nombre no puede exceder 80 caracteres')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.]+$/, 'El nombre solo puede contener letras'),
  phone: z
    .string()
    .trim()
    .min(8, 'Teléfono inválido')
    .max(15, 'Teléfono inválido')
    .regex(/^\+?[0-9\s-]+$/, 'Formato de teléfono inválido'),
  region: z
    .string()
    .trim()
    .min(2, 'Región requerida')
    .max(50, 'Región demasiado larga'),
  district: z
    .string()
    .trim()
    .min(2, 'Distrito requerido')
    .max(50, 'Distrito demasiado largo'),
  latitude: z
    .number('La ubicación es obligatoria')
    .min(PERU_BOUNDS.minLatitude, OUTSIDE_PERU)
    .max(PERU_BOUNDS.maxLatitude, OUTSIDE_PERU),
  longitude: z
    .number('La ubicación es obligatoria')
    .min(PERU_BOUNDS.minLongitude, OUTSIDE_PERU)
    .max(PERU_BOUNDS.maxLongitude, OUTSIDE_PERU),
  categories: z
    .array(supplyCategorySchema)
    .min(1, 'Seleccione al menos una categoría de insumos')
    .max(4, 'No puede seleccionar más de 4 categorías'),
  urgency: urgencyLevelSchema,
  description: z
    .string()
    .trim()
    .min(10, 'La descripción debe tener al menos 10 caracteres')
    .max(500, 'La descripción no puede exceder 500 caracteres'),
});

export type LogisticsRequestInput = z.infer<typeof logisticsRequestSchema>;
