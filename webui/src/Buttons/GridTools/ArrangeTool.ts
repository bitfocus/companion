import { SelectTool } from './SelectTool.js'
import type { GridToolId } from './types.js'

/**
 * Rearranging by hand: dragging any button moves it, no modifier and nothing to select first.
 *
 * Select can move buttons too, but only ones already selected - dragging anything else there starts
 * a rubber-band. This tool exists for when dragging should only ever mean dragging.
 */
export class ArrangeTool extends SelectTool {
	override readonly id: GridToolId = 'arrange'

	override readonly dragAnyButton = true
}
