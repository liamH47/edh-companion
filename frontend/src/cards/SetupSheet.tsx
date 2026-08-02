import type { FieldSpec, FieldValues } from '../types'
import { Button } from '../ui/Button'
import { Sheet } from '../ui/Sheet'
import { FieldControl } from './FieldControl'

interface SetupSheetProps {
  open: boolean
  onClose: () => void
  fields: FieldSpec[]
  values: FieldValues
  onFieldChange: (name: string, value: unknown) => void
  onDone: () => void
}

/**
 * Sheet wrapping one FieldControl per setup field, titled "Board state". "Done"
 * marks the card's setup confirmed (via onDone) in addition to closing the sheet --
 * closing any other way (backdrop, Esc) only closes it, matching Sheet's normal
 * onClose contract (screen-spec.md rule 4).
 */
export function SetupSheet({
  open,
  onClose,
  fields,
  values,
  onFieldChange,
  onDone,
}: SetupSheetProps) {
  const handleDone = () => {
    onDone()
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Board state">
      <div className="flex flex-col gap-4">
        {fields.map((field) => (
          <FieldControl
            key={field.name}
            field={field}
            value={values[field.name]}
            onChange={onFieldChange}
          />
        ))}
        <Button size="lg" fullWidth onClick={handleDone}>
          Done
        </Button>
      </div>
    </Sheet>
  )
}
