import { useCallback, useEffect, useState } from 'react'
import { calculateCard } from './api'
import { Field } from './Field'
import type { CardMetadata, FieldSpec, FieldValues, OutputValues } from './types'

function defaultValues(card: CardMetadata): FieldValues {
  const values: FieldValues = {}
  for (const field of card.fields) {
    values[field.name] = field.default
  }
  return values
}

function isFieldVisible(field: FieldSpec, values: FieldValues): boolean {
  if (!field.visible_if) return true
  return values[field.visible_if.field] === field.visible_if.equals
}

/**
 * Applies two generic, schema-driven adjustments on top of a raw field change:
 *  - a field that just became hidden (visible_if no longer satisfied) resets to its
 *    default, so it can't leave a stale value behind for anything sourcing from it
 *  - a field with default_source re-syncs to that source field's value whenever the
 *    source actually changed as part of this update
 * Neither rule is specific to any one card -- both are plain properties of the schema.
 */
function withDerivedValues(
  card: CardMetadata,
  previousValues: FieldValues,
  nextValues: FieldValues,
): FieldValues {
  const derived = { ...nextValues }

  for (const field of card.fields) {
    if (field.visible_if && !isFieldVisible(field, derived)) {
      derived[field.name] = field.default
    }
  }

  for (const field of card.fields) {
    const source = field.default_source
    if (source && derived[source] !== previousValues[source]) {
      derived[field.name] = derived[source]
    }
  }

  return derived
}

interface CardFormProps {
  card: CardMetadata
}

export function CardForm({ card }: CardFormProps) {
  const [values, setValues] = useState<FieldValues>(() => defaultValues(card))
  const [outputs, setOutputs] = useState<OutputValues | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runCalculation = useCallback(
    (nextValues: FieldValues) => {
      calculateCard(card.id, nextValues)
        .then((result) => {
          setOutputs(result.outputs)
          setError(null)
        })
        .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
    },
    [card.id],
  )

  useEffect(() => {
    runCalculation(defaultValues(card))
  }, [card, runCalculation])

  const handleChange = (name: string, value: unknown) => {
    const nextValues = withDerivedValues(card, values, { ...values, [name]: value })
    setValues(nextValues)
    runCalculation(nextValues)
  }

  const handleReset = () => {
    const resetValues = defaultValues(card)
    setValues(resetValues)
    runCalculation(resetValues)
  }

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{card.name}</h2>
      <form className="flex flex-col gap-3" onSubmit={(event) => event.preventDefault()}>
        {card.fields
          .filter((field) => isFieldVisible(field, values))
          .map((field) => (
            <Field
              key={field.name}
              field={field}
              value={values[field.name]}
              onChange={handleChange}
              outputs={outputs}
            />
          ))}
      </form>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      {outputs && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-4 dark:bg-slate-900/60">
          {card.outputs.map((output) => (
            <div key={output.name} className="contents">
              <dt className="self-center text-sm text-slate-600 dark:text-slate-400">
                {output.label}
              </dt>
              <dd className="justify-self-end font-mono text-lg font-semibold text-slate-900 dark:text-slate-100">
                {String(outputs[output.name])}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <button
        type="button"
        onClick={handleReset}
        className="self-start rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        New turn
      </button>
    </section>
  )
}
