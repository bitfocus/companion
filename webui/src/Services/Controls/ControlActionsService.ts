import { useContext, useMemo, useRef } from 'react'
import { SocketContext, socketEmitPromise } from '../../util'
import { ActionInstance } from '@companion/shared/Model/ActionModel'
import { GenericConfirmModalRef } from '../../Components/GenericConfirmModal'

export interface IActionEditorService {
	addAction: (actionType: string) => void

	setValue: (actionId: string, action: ActionInstance | undefined, key: string, val: any) => void
	performDelete: (actionId: string) => void
	performDuplicate: (actionId: string) => void
	setDelay: (actionId: string, delay: number) => void
	moveCard: (dragStepId: string, dragSetId: string | number, dragIndex: number, dropIndex: number) => void
	performLearn: ((actionId: string) => void) | undefined
	setEnabled: ((actionId: string, enabled: boolean) => void) | undefined
	setHeadline: ((actionId: string, headline: string) => void) | undefined
}

export interface IActionEditorActionService {
	setValue: (key: string, val: any) => void
	performDelete: () => void
	performDuplicate: () => void
	setDelay: (delay: number) => void
	performLearn: (() => void) | undefined
	setEnabled: ((enabled: boolean) => void) | undefined
	setHeadline: ((headline: string) => void) | undefined
}

export function useControlActionsEditorService(
	controlId: string,
	stepId: string,
	setId: string | number,
	confirmModal: React.RefObject<GenericConfirmModalRef>
): IActionEditorService {
	const socket = useContext(SocketContext)

	return useMemo(
		() => ({
			addAction: (actionType: string) => {
				const [connectionId, actionId] = actionType.split(':', 2)
				socketEmitPromise(socket, 'controls:action:add', [controlId, stepId, setId, connectionId, actionId]).catch(
					(e) => {
						console.error('Failed to add control action', e)
					}
				)
			},

			moveCard: (dragStepId: string, dragSetId: string | number, dragIndex: number, dropIndex: number) => {
				socketEmitPromise(socket, 'controls:action:reorder', [
					controlId,
					dragStepId,
					dragSetId,
					dragIndex,
					stepId,
					setId,
					dropIndex,
				]).catch((e) => {
					console.error('Failed to reorder control actions', e)
				})
			},

			setValue: (actionId: string, action: ActionInstance | undefined, key: string, val: any) => {
				if (!action?.options || action.options[key] !== val) {
					socketEmitPromise(socket, 'controls:action:set-option', [controlId, stepId, setId, actionId, key, val]).catch(
						(e) => {
							console.error('Failed to set control action option', e)
						}
					)
				}
			},

			setDelay: (actionId: string, delay: number) => {
				socketEmitPromise(socket, 'controls:action:set-delay', [controlId, stepId, setId, actionId, delay]).catch(
					(e) => {
						console.error('Failed to set control action delay', e)
					}
				)
			},

			performDelete: (actionId: string) => {
				confirmModal.current?.show('Delete action', 'Delete action?', 'Delete', () => {
					socketEmitPromise(socket, 'controls:action:remove', [controlId, stepId, setId, actionId]).catch((e) => {
						console.error('Failed to remove control action', e)
					})
				})
			},

			performDuplicate: (actionId: string) => {
				socketEmitPromise(socket, 'controls:action:duplicate', [controlId, stepId, setId, actionId]).catch((e) => {
					console.error('Failed to duplicate control action', e)
				})
			},

			performLearn: (actionId: string) => {
				socketEmitPromise(socket, 'controls:action:learn', [controlId, stepId, setId, actionId]).catch((e) => {
					console.error('Failed to learn control action values', e)
				})
			},

			setEnabled: (actionId: string, enabled: boolean) => {
				socketEmitPromise(socket, 'controls:action:enabled', [controlId, stepId, setId, actionId, enabled]).catch(
					(e) => {
						console.error('Failed to enable/disable action', e)
					}
				)
			},

			setHeadline: (actionId: string, headline: string) => {
				socketEmitPromise(socket, 'controls:action:set-headline', [controlId, stepId, setId, actionId, headline]).catch(
					(e) => {
						console.error('Failed to set action headline', e)
					}
				)
			},
		}),
		[socket, confirmModal, controlId, stepId, setId]
	)
}

export function useActionRecorderActionService(sessionId: string): IActionEditorService {
	const socket = useContext(SocketContext)

	return useMemo(
		() => ({
			addAction: (_actionType: string) => {
				// Not supported
			},
			moveCard: (_dragStepId: string, _dragSetId: string | number, dragIndex: number, dropIndex: number) => {
				socketEmitPromise(socket, 'action-recorder:session:action-reorder', [sessionId, dragIndex, dropIndex]).catch(
					(e) => {
						console.error(e)
					}
				)
			},

			setValue: (actionId: string, _action: ActionInstance | undefined, key: string, value: any) => {
				socketEmitPromise(socket, 'action-recorder:session:action-set-value', [sessionId, actionId, key, value]).catch(
					(e) => {
						console.error(e)
					}
				)
			},

			setDelay: (actionId: string, delay: number) => {
				socketEmitPromise(socket, 'action-recorder:session:action-delay', [sessionId, actionId, delay]).catch((e) => {
					console.error(e)
				})
			},

			performDelete: (actionId: string) => {
				socketEmitPromise(socket, 'action-recorder:session:action-delete', [sessionId, actionId]).catch((e) => {
					console.error(e)
				})
			},

			performDuplicate: (actionId: string) => {
				socketEmitPromise(socket, 'action-recorder:session:action-duplicate', [sessionId, actionId]).catch((e) => {
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
			setDelay: (delay: number) => serviceFactory.setDelay(actionId, delay),
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
