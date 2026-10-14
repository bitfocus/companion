import { observable } from 'mobx'

/** Whether the command palette is currently open. Shared so any component can open it directly. */
export const commandPaletteOpen = observable.box(false)
