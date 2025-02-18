import { ActionSetId } from '@companion-app/shared/Model/ActionModel.js'
import { useContext, useMemo } from 'react'
import type { GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'
import { SocketContext } from '../../util.js'

export interface IControlActionStepsAndSetsService {
	// readonly listId: SomeSocketEntityLocation
	readonly confirmModal: React.RefObject<GenericConfirmModalRef>

	appendStep: () => void
	removeStep: (stepId: string) => void
	duplicateStep: (stepId: string) => void
	swapSteps: (stepId1: string, stepId2: string) => void
	setCurrentStep: (stepId: string) => void
	appendSet: (stepId: string) => void
	removeSet: (stepId: string, setId: ActionSetId) => void
}

export function useControlActionStepsAndSetsService(
	controlId: string,
	confirmModal: React.RefObject<GenericConfirmModalRef>,
	setSelectedStep: (stepId: string) => void
): IControlActionStepsAndSetsService {
	const socket = useContext(SocketContext)

	return useMemo(
		() => ({
			confirmModal,

			appendStep: () => {
				socket
					.emitPromise('controls:step:add', [controlId])
					.then((newStep) => {
						if (newStep) {
							setSelectedStep(`step:${newStep}`)
							setTimeout(() => setSelectedStep(`step:${newStep}`), 500)
						}
					})
					.catch((e) => {
						console.error('Failed to append step:', e)
					})
			},
			removeStep: (stepId: string) => {
				confirmModal.current?.show('Remove step', 'Are you sure you wish to remove this step?', 'Remove', () => {
					socket.emitPromise('controls:step:remove', [controlId, stepId]).catch((e) => {
						console.error('Failed to delete step:', e)
					})
				})
			},

			duplicateStep: (stepId: string) => {
				socket.emitPromise('controls:step:duplicate', [controlId, stepId]).catch((e) => {
					console.error('Failed to duplicate step:', e)
				})
			},

			swapSteps: (stepId1: string, stepId2: string) => {
				socket
					.emitPromise('controls:step:swap', [controlId, stepId1, stepId2])
					.then(() => {
						setSelectedStep(`step:${stepId2}`)
					})
					.catch((e) => {
						console.error('Failed to swap steps:', e)
					})
			},

			setCurrentStep: (stepId: string) => {
				socket.emitPromise('controls:step:set-current', [controlId, stepId]).catch((e) => {
					console.error('Failed to set step:', e)
				})
			},

			appendSet: (stepId: string) => {
				socket.emitPromise('controls:action-set:add', [controlId, stepId]).catch((e) => {
					console.error('Failed to append set:', e)
				})
			},

			removeSet: (stepId: string, setId: ActionSetId) => {
				confirmModal.current?.show('Remove set', 'Are you sure you wish to remove this group?', 'Remove', () => {
					socket.emitPromise('controls:action-set:remove', [controlId, stepId, setId]).catch((e) => {
						console.error('Failed to delete set:', e)
					})
				})
			},
		}),
		[controlId, confirmModal, setSelectedStep]
	)
}
