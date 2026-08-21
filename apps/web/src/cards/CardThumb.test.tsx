import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CardThumb } from './CardThumb'

const BLOOD_ARTIST = 'b5275d76-2947-4219-be21-614c7421614a'

describe('CardThumb', () => {
  it('renders the printed card, decoratively', () => {
    render(<CardThumb scryfallId={BLOOD_ARTIST} />)
    const img = document.querySelector('img')!
    expect(img.src).toContain(BLOOD_ARTIST)
    // `small` is the full card, so the artist and copyright line stay in frame.
    expect(img.src).toContain('version=small')
    // Decorative: every caller puts the name beside it, so it stays out of the a11y tree.
    expect(img.getAttribute('alt')).toBe('')
    expect(screen.queryByTestId('card-thumb-fallback')).not.toBeInTheDocument()
  })

  it('shows the card-back tile when there is no card behind the entry', () => {
    render(<CardThumb scryfallId={null} />)
    expect(screen.getByTestId('card-thumb-fallback')).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
  })

  it('degrades to the tile when the image cannot load', () => {
    render(<CardThumb scryfallId={BLOOD_ARTIST} />)
    fireEvent.error(document.querySelector('img')!)
    expect(screen.getByTestId('card-thumb-fallback')).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
  })

  it('takes a caller width, keeping the printed aspect either way', () => {
    const { rerender } = render(<CardThumb scryfallId={BLOOD_ARTIST} width="w-8" />)
    expect(document.querySelector('img')!.className).toContain('w-8')
    expect(document.querySelector('img')!.className).toContain('aspect-[488/680]')
    // The tile follows the same width, so a failed load doesn't reflow the row.
    rerender(<CardThumb scryfallId={null} width="w-8" />)
    expect(screen.getByTestId('card-thumb-fallback').className).toContain('w-8')
  })
})
