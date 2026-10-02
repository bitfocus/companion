import { createContext } from 'react'

/**
 * The element at the bottom of the edit button summary card that the editor tabs portal into, so the
 * tabs share the card (and its sticky position) without the tab state having to move up to it.
 */
export const EditButtonTabsSlotContext = createContext<HTMLElement | null>(null)
