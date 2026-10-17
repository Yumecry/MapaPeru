'use client';

import { useActionState } from 'react';
import { signIn, type LoginState } from './actions';

const INITIAL_STATE: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-200">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-200">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded bg-red-900/50 px-3 py-2 text-sm text-red-200">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-amber-500 px-3 py-2 font-bold text-slate-900 transition-colors hover:bg-amber-600 disabled:opacity-60"
      >
        {pending ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  );
}
