import { create } from 'zustand'
import {
  PRODUCT_SELECTION_MAX,
  productSelectionSchema,
  type ProductSelection,
} from '@contracts/cards.ts'

/**
 * The products the customer has selected to compare (Chris, 2026-11-13: "select products from
 * any of the cards that are presented, then compare the two that have been selected").
 *
 * Ephemeral UI state, which is what Zustand is for here: nothing persists, and the selection is
 * sent with the next message (`selection` on the turn) and cleared once that turn's reply
 * arrives. One product is one selection however many cards show it (by `rowId`), so a row
 * selected on one card shows the tick on every card it appears on. Up to three.
 */
export type SelectedProduct = ProductSelection & {
  /** The card it was selected on (the chat entry's id), for the refusal note's place. */
  readonly cardMessageId: string
}

export type ToggleResult = 'added' | 'removed' | 'refused'

type ProductSelectionState = {
  readonly selected: readonly SelectedProduct[]
  /** The card where a fourth selection was just refused, so the note shows there; else null. */
  readonly refusedOn: string | null
  readonly toggle: (product: SelectedProduct) => ToggleResult
  /** Takes these products out, leaving any selected since (the reply to a turn that sent them). */
  readonly remove: (rowIds: readonly string[]) => void
  readonly clear: () => void
}

export const useProductSelection = create<ProductSelectionState>((set, get) => ({
  selected: [],
  refusedOn: null,
  toggle: (product) => {
    const { selected } = get()
    if (selected.some((item) => item.rowId === product.rowId)) {
      set({ selected: selected.filter((item) => item.rowId !== product.rowId), refusedOn: null })
      return 'removed'
    }
    if (selected.length >= PRODUCT_SELECTION_MAX) {
      set({ refusedOn: product.cardMessageId })
      return 'refused'
    }
    set({ selected: [...selected, product], refusedOn: null })
    return 'added'
  },
  remove: (rowIds) => {
    const gone = new Set(rowIds)
    set(({ selected }) => ({
      selected: selected.filter((item) => !gone.has(item.rowId)),
      refusedOn: null,
    }))
  },
  clear: () => set({ selected: [], refusedOn: null }),
}))

/**
 * What goes on the turn: the products in the order they were selected, without the card, held to
 * the turn's own contract (`productSelectionSchema`). A lead is cut to the length the turn takes;
 * a row id the turn would refuse (outside `PRODUCT_ROW_ID_PATTERN`) is left out rather than
 * failing the customer's whole message.
 */
export function selectionForTurn(selected: readonly SelectedProduct[]): ProductSelection[] {
  return selected.flatMap(({ rowId, lead }) => {
    const parsed = productSelectionSchema.safeParse({ rowId, lead: lead.trim().slice(0, 160) })
    return parsed.success ? [parsed.data] : []
  })
}
