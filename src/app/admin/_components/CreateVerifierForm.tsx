'use client';

import { useActionState, useState } from 'react';
import { KeyRound, UserPlus } from 'lucide-react';
import { PASSWORD_MAX, PASSWORD_MIN } from '@/application/schemas/verifier-admin.schema';
import { createVerifier, type AdminActionState } from '../actions';
import { ActionMessage } from './ActionMessage';
import { generatePassword } from './password';

const INITIAL_STATE: AdminActionState = { error: null, notice: null };

const INPUT_CLASS =
  'w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none';

export function CreateVerifierForm() {
  const [state, formAction, pending] = useActionState(createVerifier, INITIAL_STATE);
  // Campos controlados: React resetea los no controlados tras cada envío y se perdería la
  // contraseña que el admin todavía tiene que copiar.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [handled, setHandled] = useState(state);

  if (state !== handled) {
    setHandled(state);
    if (state.notice) setEmail('');
  }

  return (
    <details className="rounded-lg bg-slate-900 p-4 shadow">
      <summary className="flex cursor-pointer items-center gap-2 font-semibold">
        <UserPlus className="h-4 w-4 text-amber-400" />
        Añadir verificador
      </summary>

      <form action={formAction} className="mt-4 space-y-3">
        <div>
          <label htmlFor="new-email" className="mb-1 block text-sm text-slate-300">
            Correo electrónico
          </label>
          <input
            id="new-email"
            name="email"
            type="email"
            autoComplete="off"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="new-password" className="mb-1 block text-sm text-slate-300">
            Contraseña temporal
          </label>
          <div className="flex gap-2">
            <input
              id="new-password"
              name="password"
              type="text"
              autoComplete="off"
              spellCheck={false}
              required
              minLength={PASSWORD_MIN}
              maxLength={PASSWORD_MAX}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={`${INPUT_CLASS} font-mono`}
            />
            <button
              type="button"
              onClick={() => setPassword(generatePassword())}
              className="flex shrink-0 items-center gap-1 rounded bg-slate-700 px-3 py-2 text-sm transition-colors hover:bg-slate-600"
            >
              <KeyRound className="h-4 w-4" />
              Generar
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Mínimo {PASSWORD_MIN} caracteres. Cópiela y envíela a la persona por un canal seguro.
          </p>
        </div>

        <div>
          <label htmlFor="new-role" className="mb-1 block text-sm text-slate-300">
            Rol
          </label>
          <select id="new-role" name="role" defaultValue="verificador" className={INPUT_CLASS}>
            <option value="verificador">Verificador (aprueba y rechaza solicitudes)</option>
            <option value="admin">Administrador (además gestiona el equipo)</option>
          </select>
        </div>

        <ActionMessage state={state} />

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-amber-500 px-3 py-2 text-sm font-bold text-slate-900 transition-colors hover:bg-amber-600 disabled:opacity-60 sm:w-auto"
        >
          {pending ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>
    </details>
  );
}
