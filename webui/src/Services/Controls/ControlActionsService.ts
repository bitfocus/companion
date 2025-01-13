import { useContext, useMemo, useRef } from 'react'
import { SocketContext } from '../../util.js'
import { ActionInstance, ActionSetId } from '@companion-app/shared/Model/ActionModel.js'
import { GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'

export interface IActionEditorService {
	addAction: (actionType: string, parentId: string | null) => void

	setValue: (actionId: string, action: ActionInstance | undefined, key: string, val: any) => void
	performDelete: (actionId: string) => void
	performDuplicate: (actionId: string) => void
	setConnection: (actionId: string, connectionId: string | number) => void
	moveCard: (
		dragStepId: string,
		dragSetId: ActionSetId,
		dragActionId: string,
		dropParentId: string | null,
		dropIndex: number
	) => void
	performLearn: ((actionId: string) => void) | undefined
	setEnabled: ((actionId: string, enabled: boolean) => void) | undefined
	setHeadline: ((actionId: string, headline: string) => void) | undefined
}

export interface IActionEditorActionService {
	setValue: (key: string, val: any) => void
	performDelete: () => void
	performDuplicate: () => void
	setConnection: (connectionId: string | number) => void
	performLearn: (() => void) | undefined
	setEnabled: ((enabled: boolean) => void) | undefined
	setHeadline: ((headline: string) => void) | undefined
}

export function useControlActionsEditorService(
	controlId: string,
	stepId: string,
	setId: ActionSetId,
	confirmModal: React.RefObject<GenericConfirmModalRef>
): IActionEditorService {
	const socket = useContext(SocketContext)

	return useMemo(
		() => ({
			addAction: (actionType: string, parentId: string | null) => {
				const [connectionId, actionId] = actionType.split(':', 2)
				socket
					.emitPromise('controls:action:add', [
						controlId,
						stepId,
						setId,
						parentId ? { parentActionId: parentId, childGroup: 'default' } : null,
						connectionId,
						actionId,
					])
					.catch((e) => {
						console.error('Failed to add control action', e)
					})
			},

			moveCard: (
				dragStepId: string,
				dragSetId: ActionSetId,
				dragActionId: string,
				dropParentId: string | null,
				dropIndex: number
			) => {
				socket
					.emitPromise('controls:action:move', [
						controlId,
						dragStepId,
						dragSetId,
						dragActionId,
						stepId,
						setId,
						dropParentId ? { parentActionId: dropParentId, childGroup: 'default' } : null,
						dropIndex,
					])
					.catch((e) => {
						console.error('Failed to reorder control actions', e)
					})
			},

			setValue: (actionId: string, action: ActionInstance | undefined, key: string, val: any) => {
				if (!action?.options || action.options[key] !== val) {
					socket
						.emitPromise('controls:action:set-option', [controlId, stepId, setId, actionId, key, val])
						.catch((e) => {
							console.error('Failed to set control action option', e)
						})
				}
			},

			setConnection: (actionId: string, connectionId: string | number) => {
				socket
					.emitPromise('controls:action:set-connection', [controlId, stepId, setId, actionId, connectionId + ''])
					.catch((e) => {
						console.error('Failed to set control action connection', e)
					})
			},

			performDelete: (actionId: string) => {
				confirmModal.current?.show('Delete action', 'Delete action?', 'Delete', () => {
					socket.emitPromise('controls:action:remove', [controlId, stepId, setId, actionId]).catch((e) => {
						console.error('Failed to remove control action', e)
					})
				})
			},

			performDuplicate: (actionId: string) => {
				socket.emitPromise('controls:action:duplicate', [controlId, stepId, setId, actionId]).catch((e) => {
					console.error('Failed to duplicate control action', e)
				})
			},

			performLearn: (actionId: string) => {
				socket.emitPromise('controls:action:learn', [controlId, stepId, setId, actionId]).catch((e) => {
					console.error('Failed to learn control action values', e)
				})
			},

			setEnabled: (actionId: string, enabled: boolean) => {
				socket.emitPromise('controls:action:enabled', [controlId, stepId, setId, actionId, enabled]).catch((e) => {
					console.error('Failed to enable/disable action', e)
				})
			},

			setHeadline: (actionId: string, headline: string) => {
				socket
					.emitPromise('controls:action:set-headline', [controlId, stepId, setId, actionId, headline])
					.catch((e) => {
						console.error('Failed to set action headline', e)
					})
			},
		}),
		[socket, confirmModal, controlId, stepId, setId]
	)
}

export function useActionRecorderActionService(sessionId: string): IActionEditorService {
	const socket = useContext(SocketContext)

	return useMemo(
		() => ({
			addAction: (_actionType: string, _parentId: string | null) => {
				// Not supported
			},
			moveCard: (
				_dragStepId: string,
				_dragSetId: ActionSetId,
				dragActionId: string,
				_dropParentId: string | null,
				dropIndex: number
			) => {
				socket
					.emitPromise('action-recorder:session:action-reorder', [sessionId, dragActionId, dropIndex])
					.catch((e) => {
						console.error(e)
					})
			},

			setValue: (actionId: string, _action: ActionInstance | undefined, key: string, value: any) => {
				socket.emitPromise('action-recorder:session:action-set-value', [sessionId, actionId, key, value]).catch((e) => {
					console.error(e)
				})
			},

			setConnection: (_actionId: string, _connectionId: string | number) => {
				// Not implemented in action recorder
			},

			setDelay: (actionId: string, delay: number) => {
				socket.emitPromise('action-recorder:session:action-delay', [sessionId, actionId, delay]).catch((e) => {
					console.error(e)
				})
			},

			performDelete: (actionId: string) => {
				socket.emitPromise('action-recorder:session:action-delete', [sessionId, actionId]).catch((e) => {
					console.error(e)
				})
			},

			performDuplicate: (actionId: string) => {
				socket.emitPromise('action-recorder:session:action-duplicate', [sessionId, actionId]).catch((e) => {
					console.error(e)
				})
			},

			performLearn: undefined,
			setEnabled: undefined,
			setHeadline: undefined,
		}),
		[socket, sessionId]
	)
}

export function useControlActionService(
	serviceFactory: IActionEditorService,
	action: ActionInstance
): IActionEditorActionService {
	const socket = useContext(SocketContext)

	const actionRef = useRef<ActionInstance>()
	actionRef.current = action

	const actionId = action.id

	return useMemo(
		() => ({
			setValue: (key: string, val: any) => serviceFactory.setValue(actionId, actionRef.current, key, val),
			performDelete: () => serviceFactory.performDelete(actionId),
			performDuplicate: () => serviceFactory.performDuplicate(actionId),
			setConnection: (connectionId: string | number) => serviceFactory.setConnection(actionId, connectionId),
			performLearn: serviceFactory.performLearn ? () => serviceFactory.performLearn?.(actionId) : undefined,
			setEnabled: serviceFactory.setEnabled
				? (enabled: boolean) => serviceFactory.setEnabled?.(actionId, enabled)
				: undefined,
			setHeadline: serviceFactory.setHeadline
				? (headline: string) => serviceFactory.setHeadline?.(actionId, headline)
				: undefined,
		}),
		[socket, serviceFactory, actionId]
	)
}
