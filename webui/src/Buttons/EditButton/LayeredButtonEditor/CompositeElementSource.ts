import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import type { CompositeElementDefinitionsStore } from '~/Stores/CompositeElementDefinitionsStore.js'
import type { ConnectionsStore } from '~/Stores/ConnectionsStore.js'

/**
 * Why a composite element can't be drawn because its definition is missing, or null if it isn't
 */
export function getMissingCompositeElementReason(
	element: SomeButtonGraphicsElement,
	compositeElementDefinitions: CompositeElementDefinitionsStore,
	connections: ConnectionsStore
): string | null {
	if (element.type !== 'composite') return null
	if (compositeElementDefinitions.getDefinition(element.connectionId, element.elementId)) return null

	const connectionLabel = connections.getLabel(element.connectionId)
	if (!connectionLabel) return `Missing element: the connection it came from no longer exists`

	return `Missing element: connection "${connectionLabel}" does not provide "${element.elementId}"`
}

/**
 * Which connection and definition a composite element comes from, as `connection: definition`, or null if
 * it isn't a composite. Falls back to the stored ids when either is gone.
 */
export function getCompositeElementSource(
	element: SomeButtonGraphicsElement,
	compositeElementDefinitions: CompositeElementDefinitionsStore,
	connections: ConnectionsStore
): string | null {
	if (element.type !== 'composite') return null

	const connectionLabel = connections.getLabel(element.connectionId) ?? element.connectionId
	const definition = compositeElementDefinitions.getDefinition(element.connectionId, element.elementId)

	return `${connectionLabel}: ${definition?.name ?? element.elementId}`
}
