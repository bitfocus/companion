/**
 * The connection id of the internal module, which provides the actions and feedbacks built into Companion
 */
export const INTERNAL_CONNECTION_ID = 'internal'

/**
 * The connection id which provides each custom action as an action
 */
export const CUSTOM_ACTIONS_CONNECTION_ID = '__custom-actions__'

/**
 * Connection ids which are provided by Companion itself, rather than by a user created connection.
 * Entities referencing these are always valid, even though there is no connection with this id.
 */
const VIRTUAL_CONNECTION_IDS: ReadonlySet<string> = new Set([INTERNAL_CONNECTION_ID, CUSTOM_ACTIONS_CONNECTION_ID])

/**
 * Check if a connection id refers to the internal module
 */
export function isInternalConnectionId(connectionId: string | null | undefined): boolean {
	return connectionId === INTERNAL_CONNECTION_ID
}

/**
 * Check if a connection id refers to the custom actions
 */
export function isCustomActionsConnectionId(connectionId: string | null | undefined): boolean {
	return connectionId === CUSTOM_ACTIONS_CONNECTION_ID
}

/**
 * Check if a connection id refers to something provided by Companion itself (eg the internal module), rather than a user created connection
 */
export function isVirtualConnectionId(connectionId: string | null | undefined): boolean {
	return !!connectionId && VIRTUAL_CONNECTION_IDS.has(connectionId)
}

/**
 * Get all of the connection ids provided by Companion itself
 */
export function getVirtualConnectionIds(): ReadonlySet<string> {
	return VIRTUAL_CONNECTION_IDS
}
