import type { ChangeEvent } from 'react'
import type { FieldSpec, OutputValues } from './types'

interface FieldProps {
  field: FieldSpec
  value: unknown
  onChange: (name: string, value: unknown) => void
  /** Most recent calculate() result, needed only to evaluate action_disabled_when
   * (a guard against an *output*, e.g. "can't afford this" -- not the field's own
   * value/bounds, which every other check here is based on). Optional since most
   * fields have no such guard and most callers (tests especially) don't need it. */
  outputs?: OutputValues | null
}

function isActionGuardBlocked(field: FieldSpec, outputs: OutputValues | null): boolean {
  const guard = field.action_disabled_when
  if (!guard) return false
  if (!outputs) return true // outputs not known yet -- default to disabled, not permissive
  const guardedValue = outputs[guard.output]
  return typeof guardedValue !== 'number' || guardedValue < guard.less_than
}

function assertNever(value: never): never {
  throw new Error(`Unhandled field kind from API: ${JSON.stringify(value)}`)
}

const inputClasses =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

const labelClasses = 'text-sm font-medium text-slate-700 dark:text-slate-300'

/**
 * Renders one form control per FieldSpec.kind. Driven entirely by what the
 * backend's /api/cards returns -- a new card with these four kinds needs no
 * new component here.
 */
export function Field({ field, value, onChange, outputs = null }: FieldProps) {
  switch (field.kind) {
    case 'boolean':
      return (
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange(field.name, event.target.checked)
            }
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-600 dark:bg-slate-700"
          />
          <span className={labelClasses}>{field.label}</span>
        </label>
      )
    case 'number':
      return (
        <label className="flex flex-col gap-1">
          <span className={labelClasses}>{field.label}</span>
          <input
            type="number"
            value={typeof value === 'number' ? value : 0}
            min={field.min ?? undefined}
            max={field.max ?? undefined}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange(field.name, Number(event.target.value))
            }
            className={inputClasses}
          />
        </label>
      )
    case 'select':
      return (
        <label className="flex flex-col gap-1">
          <span className={labelClasses}>{field.label}</span>
          <select
            value={typeof value === 'string' ? value : ''}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              onChange(field.name, event.target.value)
            }
            className={inputClasses}
          >
            {(field.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )
    case 'counter': {
      const count = typeof value === 'number' ? value : 0
      const atMax = field.max != null && count >= field.max
      const actionDisabled = atMax || isActionGuardBlocked(field, outputs)
      return (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-700">
          <span className={labelClasses}>{field.label}</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              aria-label={field.label}
              value={count}
              min={field.min ?? undefined}
              max={field.max ?? undefined}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onChange(field.name, Number(event.target.value))
              }
              className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center font-mono text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="button"
              disabled={actionDisabled}
              onClick={() => onChange(field.name, count + 1)}
              className="whitespace-nowrap rounded-full bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
            >
              {field.action_label ?? '+1'}
            </button>
          </div>
        </div>
      )
    }
    default:
      return assertNever(field.kind)
  }
}
