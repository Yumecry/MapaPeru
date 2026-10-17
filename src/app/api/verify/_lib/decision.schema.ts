import { z } from 'zod';

export const decisionSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('verificado') }),
  z.object({
    status: z.literal('rechazado'),
    reason: z
      .string()
      .trim()
      .min(3, 'El motivo debe tener al menos 3 caracteres')
      .max(300, 'El motivo no puede superar 300 caracteres'),
  }),
]);

export const requestIdSchema = z.string().uuid();
