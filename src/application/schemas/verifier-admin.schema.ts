import { z } from 'zod';

// bcrypt (Supabase Auth) solo usa los primeros 72 bytes de la contraseña.
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72;

export const verifierRoleSchema = z.enum(['admin', 'verificador'], {
  error: 'Rol inválido',
});

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`)
  .max(PASSWORD_MAX, `La contraseña no puede superar ${PASSWORD_MAX} caracteres`);

export const newVerifierSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Ingrese un correo electrónico válido')
    .max(254, 'El correo es demasiado largo'),
  password: passwordSchema,
  role: verifierRoleSchema,
});

export const verifierIdSchema = z.string().uuid('Identificador de verificador inválido');
