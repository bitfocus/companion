import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type { ConnectionsStore } from '~/Stores/ConnectionsStore.js'
import type { EntityDefinitionsStore } from '~/Stores/EntityDefinitionsStore.js'

export interface ActionEntry {
	connectionId: string
	connectionLabel: string
	moduleId: string
	definitionId: string
	label: string
	options: Record<string, unknown>
	usedBefore: boolean
	noActions?: boolean
}

// Build the draggable action library from Companion's live connection + action definitions.
// `usedKeys` is a set of `connectionId:definitionId` already present on the current button.
export function buildActionLibrary(
	connections: ConnectionsStore,
	entityDefinitions: EntityDefinitionsStore,
	usedKeys: Set<string>
): ActionEntry[] {
	const actionStore = entityDefinitions.getEntityDefinitionsStore(EntityModelType.Action)
	const result: ActionEntry[] = []

	for (const [connectionId, defs] of actionStore.connections.entries()) {
		const conn = connections.connections.get(connectionId)
		const connectionLabel = connectionId === 'internal' ? 'Internal' : (conn?.label ?? connectionId)
		const moduleId = connectionId === 'internal' ? 'internal' : (conn?.moduleId ?? '')

		if (!defs || defs.size === 0) {
			result.push({
				connectionId,
				connectionLabel,
				moduleId,
				definitionId: '',
				label: '',
				options: {},
				usedBefore: false,
				noActions: true,
			})
			continue
		}

		for (const [definitionId, def] of defs.entries()) {
			result.push({
				connectionId,
				connectionLabel,
				moduleId,
				definitionId,
				label: def?.label ?? definitionId,
				options: {},
				usedBefore: usedKeys.has(`${connectionId}:${definitionId}`),
			})
		}
	}

	return result
}
