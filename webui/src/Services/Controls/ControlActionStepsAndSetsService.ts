import { useMemo } from 'react'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { trpc, useMutationExt } from '~/TRPC'

export interface IControlActionStepsAndSetsService {
	// readonly listId: SomeSocketEntityLocation
	readonly confirmModal: React.RefObject<GenericConfirmModalRef>

	appendStep: () => void
	removeStep: (stepId: string) => void
	duplicateStep: (stepId: string) => void
	swapSteps: (stepId1: string, stepId2: string) => void
	setCurrentStep: (stepId: string) => void
	appendSet: (stepId: string) => void
	removeSet: (stepId: string, setId: number) => void
}

export function useControlActionStepsAndSetsService(
	controlId: string,
	confirmModal: React.RefObject<GenericConfirmModalRef>,
	setSelectedStep: (stepId: string) => void
): IControlActionStepsAndSetsService {
	const addStepMutation = useMutationExt(trpc.controls.steps.add.mutationOptions())
	const removeStepMutation = useMutationExt(trpc.controls.steps.remove.mutationOptions())
	const duplicateStepMutation = useMutationExt(trpc.controls.steps.duplicate.mutationOptions())
	const swapStepsMutation = useMutationExt(trpc.controls.steps.swap.mutationOptions())
	const setCurrentStepMutation = useMutationExt(trpc.controls.steps.setCurrent.mutationOptions())

	const addSetMutation = useMutationExt(trpc.controls.actionSets.add.mutationOptions())
	const removeSetMutation = useMutationExt(trpc.controls.actionSets.remove.mutationOptions())

	return useMemo(
		() => ({
			confirmModal,

			appendStep: () => {
				addStepMutation
					.mutateAsync({ controlId })
					.then((newStep) => {
						if (typeof newStep === 'string') {
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
					removeStepMutation.mutateAsync({ controlId, stepId }).catch((e) => {
						console.error('Failed to delete step:', e)
					})
				})
			},

			duplicateStep: (stepId: string) => {
				duplicateStepMutation.mutateAsync({ controlId, stepId }).catch((e) => {
					console.error('Failed to duplicate step:', e)
				})
			},

			swapSteps: (stepId1: string, stepId2: string) => {
				swapStepsMutation
					.mutateAsync({ controlId, stepId1, stepId2 })
					.then(() => {
						setSelectedStep(`step:${stepId2}`)
					})
					.catch((e) => {
						console.error('Failed to swap steps:', e)
					})
			},

			setCurrentStep: (stepId: string) => {
				setCurrentStepMutation.mutateAsync({ controlId, stepId }).catch((e) => {
					console.error('Failed to set step:', e)
				})
			},

			appendSet: (stepId: string) => {
				addSetMutation.mutateAsync({ controlId, stepId }).catch((e) => {
					console.error('Failed to append set:', e)
				})
			},

			removeSet: (stepId: string, setId: number) => {
				confirmModal.current?.show('Remove set', 'Are you sure you wish to remove this group?', 'Remove', () => {
					removeSetMutation.mutateAsync({ controlId, stepId, setId }).catch((e) => {
						console.error('Failed to delete set:', e)
					})
				})
			},
		}),
		[
			controlId,
			confirmModal,
			setSelectedStep,
			addStepMutation,
			removeStepMutation,
			duplicateStepMutation,
			swapStepsMutation,
			setCurrentStepMutation,
			addSetMutation,
			removeSetMutation,
		]
	)
}
