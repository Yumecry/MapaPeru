import type { AdminActionState } from '../actions';

export function ActionMessage({ state }: { state: AdminActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded bg-red-900/50 px-3 py-2 text-sm text-red-200">
        {state.error}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p role="status" className="rounded bg-emerald-900/50 px-3 py-2 text-sm text-emerald-200">
        {state.notice}
      </p>
    );
  }
  return null;
}
