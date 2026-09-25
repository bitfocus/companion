import { observable } from 'mobx'

/** Whether the page matrix modal is open. Shared so the command palette can open it too. */
export const pageMatrixOpen = observable.box(false)
