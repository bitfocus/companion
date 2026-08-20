import { DeleteTool } from './DeleteTool.js'
import { PressTool } from './PressTool.js'
import { SelectTool } from './SelectTool.js'
import { TransferTool } from './TransferTool.js'
import type { GridTool, GridToolId } from './types.js'

export * from './types.js'
export { buildTransferPairs } from './TransferTool.js'

export const DEFAULT_GRID_TOOL_ID: GridToolId = 'select'

export function createGridTool(id: GridToolId): GridTool {
	switch (id) {
		case 'select':
			return new SelectTool()
		case 'press':
			return new PressTool()
		case 'copy':
		case 'move':
		case 'swap':
			return new TransferTool(id)
		case 'delete':
			return new DeleteTool()
	}
}
