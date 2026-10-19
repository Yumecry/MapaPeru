'use client';

import { useActionState, useState } from 'react';
import { KeyRound } from 'lucide-react';
import type { VerifierAccount } from '@/domain/entities/verifier.entity';
import { PASSWORD_MAX, PASSWORD_MIN } from '@/application/schemas/verifier-admin.schema';
import {
  changeVerifierRole,
  resetVerifierPassword,
  setVerifierDisabled,
  type AdminActionState,
} from '../actions';
import { ActionMessage } from './ActionMessage';
import { generatePassword } from './password';

const INITIAL_STATE: AdminActionState = { error: null, notice: null };

const ROLE_LABELS = { admin: 'Administrador', verificador: 'Verificador' } as const;

const DATE_FORMAT = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeZone: 'America/Lima',
});

const BUTTON_CLASS =
  'rounded bg-slate-700 px-3 py-2 text-sm transition-colors hover:bg-slate-600 disabled:opacity-60';

export function VerifierRow({ account, isSelf }: { account: VerifierAccount; isSelf: boolean }) {
  const [roleState, roleAction, rolePending] = useActionState(changeVerifierRole, INITIAL_STATE);
  const [statusState, statusAction, statusPending] = useActionState(
    setVerifierDisabled,
    INITIAL_STATE,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    resetVerifierPassword,
    INITIAL_STATE,
  );
  const [resetting, setResetting] = useState(false);
  const [password, setPassword] = useState('');

  const disabled = !!account.disabledAt;
  const pending = rolePending || statusPending || passwordPending;
  const nextRole = account.role === 'admin' ? 'verificador' : 'admin';

  return (
    <li className={`rounded-lg bg-slate-900 p-4 shadow ${disabled ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold break-all">
            {account.email}
            {isSelf && <span className="ml-2 text-xs font-normal text-slate-400">(usted)</span>}
          </p>
          <p className="text-xs text-slate-400">
            Alta: {DATE_FORMAT.format(new Date(account.createdAt))}
            {account.disabledAt &&
              ` · Desactivada: ${DATE_FORMAT.format(new Date(account.disabledAt))}`}
          </p>
        </div>
        <div className="flex gap-1">
          <span
            className={`rounded px-2 py-1 text-xs font-bold ${
              account.role === 'admin' ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-white'
            }`}
          >
            {ROLE_LABELS[account.role]}
          </span>
          {disabled && (
            <span className="rounded bg-red-900 px-2 py-1 text-xs font-bold text-red-100">
              Desactivada
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-800 pt-3">
        {!isSelf && !disabled && (
          <form action={roleAction}>
            <input type="hidden" name="userId" value={account.userId} />
            <input type="hidden" name="role" value={nextRole} />
            <button type="submit" disabled={pending} className={BUTTON_CLASS}>
              {nextRole === 'admin' ? 'Hacer administrador' : 'Quitar administrador'}
            </button>
          </form>
        )}

        {!isSelf && (
          <form
            action={statusAction}
            onSubmit={(event) => {
              if (!disabled && !window.confirm(`¿Desactivar la cuenta de ${account.email}?`)) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="userId" value={account.userId} />
            <input type="hidden" name="disabled" value={disabled ? 'false' : 'true'} />
            <button
              type="submit"
              disabled={pending}
              className={
                disabled
                  ? BUTTON_CLASS
                  : 'rounded bg-red-700 px-3 py-2 text-sm text-white transition-colors hover:bg-red-800 disabled:opacity-60'
              }
            >
              {disabled ? 'Reactivar' : 'Desactivar'}
            </button>
          </form>
        )}

        {!disabled && !resetting && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setPassword(generatePassword());
              setResetting(true);
            }}
            className={`flex items-center gap-1 ${BUTTON_CLASS}`}
          >
            <KeyRound className="h-4 w-4" />
            Cambiar contraseña
          </button>
        )}
      </div>

      {resetting && (
        <form action={passwordAction} className="mt-3 space-y-2">
          <input type="hidden" name="userId" value={account.userId} />
          <label htmlFor={`password-${account.userId}`} className="block text-sm text-slate-300">
            Nueva contraseña
          </label>
          <input
            id={`password-${account.userId}`}
            name="password"
            type="text"
            autoComplete="off"
            spellCheck={false}
            required
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 font-mono text-sm text-white focus:border-amber-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-amber-500 px-3 py-2 text-sm font-bold text-slate-900 transition-colors hover:bg-amber-600 disabled:opacity-60"
            >
              {passwordPending ? 'Guardando…' : 'Guardar contraseña'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setResetting(false);
                setPassword('');
              }}
              className={BUTTON_CLASS}
            >
              Cerrar
            </button>
          </div>
        </form>
      )}

      <div className="mt-2 space-y-2 empty:hidden">
        <ActionMessage state={roleState} />
        <ActionMessage state={statusState} />
        <ActionMessage state={passwordState} />
      </div>
    </li>
  );
}
