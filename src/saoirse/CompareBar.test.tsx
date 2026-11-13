import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { CompareBar } from '@/saoirse/CompareBar'
import { useProductSelection } from '@/saoirse/productSelection'

const select = (rowId: string, lead: string): void => {
  act(() => {
    useProductSelection.getState().toggle({ rowId, lead, cardMessageId: 'card-1' })
  })
}

beforeEach(() => {
  useProductSelection.getState().clear()
})

describe('the compare bar', () => {
  it('is not there with nothing selected', () => {
    render(<CompareBar onCompare={vi.fn()} canSend />)
    expect(screen.queryByRole('group', { name: 'Selected to compare' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Compare' })).toBeNull()
  })

  it('says "1 selected" with one, Compare not yet open', () => {
    render(<CompareBar onCompare={vi.fn()} canSend />)
    select('bunq:easy-savings', 'bunq Savings')
    expect(screen.getByRole('group', { name: 'Selected to compare' })).toHaveTextContent(
      '1 selected',
    )
    expect(screen.getByRole('button', { name: 'Compare' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled()
  })

  it('names the leads with two or three, and opens Compare', () => {
    const onCompare = vi.fn()
    render(<CompareBar onCompare={onCompare} canSend />)
    select('bunq:easy-savings', 'bunq Savings')
    select('boi:supersaver', 'SuperSaver')
    expect(screen.getByText(/bunq Savings · SuperSaver$/)).toBeInTheDocument()
    // Said as a count first to a screen reader.
    expect(screen.getByText('2 selected:', { exact: false })).toHaveClass('sr-only')

    const compare = screen.getByRole('button', { name: 'Compare' })
    expect(compare).toBeEnabled()
    fireEvent.click(compare)
    expect(onCompare).toHaveBeenCalledOnce()

    select('moco:instant', 'MoCo Instant')
    expect(screen.getByText(/bunq Savings · SuperSaver · MoCo Instant$/)).toBeInTheDocument()
  })

  it('holds Compare while a turn is in flight, Clear still open', () => {
    render(<CompareBar onCompare={vi.fn()} canSend={false} />)
    select('bunq:easy-savings', 'bunq Savings')
    select('boi:supersaver', 'SuperSaver')
    expect(screen.getByRole('button', { name: 'Compare' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled()
  })

  it('clears the selection, and goes', () => {
    render(<CompareBar onCompare={vi.fn()} canSend />)
    select('bunq:easy-savings', 'bunq Savings')
    select('boi:supersaver', 'SuperSaver')
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(useProductSelection.getState().selected).toEqual([])
    expect(screen.queryByRole('group', { name: 'Selected to compare' })).toBeNull()
  })
})
