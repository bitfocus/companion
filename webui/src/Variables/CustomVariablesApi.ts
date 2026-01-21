import { useContext, useMemo } from 'react'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal'
import { RootAppStoreContext } from '~/Stores/RootAppStore'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import type { JsonValue } from 'type-fest'

export interface CustomVariablesApi {
	onCopied: () => void
	doDelete: (name: string) => void
	setDescription: (name: string, value: string) => void
	setStartupValue: (name: string, value: JsonValue) => void
	setCurrentValue: (name: string, value: JsonValue) => void
	setPersistenceValue: (name: string, persisted: boolean) => void
}

export function useCustomVariablesApi(confirmModalRef: React.RefObject<GenericConfirmModalRef>): CustomVariablesApi {
	const { notifier } = useContext(RootAppStoreContext)

	const setDefaultMutation = useMutationExt(trpc.customVariables.setDefault.mutationOptions())
	const setCurrentMutation = useMutationExt(trpc.customVariables.setCurrent.mutationOptions())
	const setPersistenceMutation = useMutationExt(trpc.customVariables.setPersistence.mutationOptions())
	const setDescriptionMutation = useMutationExt(trpc.customVariables.setDescription.mutationOptions())
	const deleteMutation = useMutationExt(trpc.customVariables.delete.mutationOptions())

	return useMemo(
		() =>
			({
				onCopied: () => {
					notifier.show(`Copied`, 'Copied to clipboard', 5000)
				},

				setStartupValue: (name: string, value: JsonValue) => {
					setDefaultMutation.mutateAsync({ name, value }).catch(() => {
						console.error('Failed to update variable')
					})
				},
				setCurrentValue: (name: string, value: JsonValue) => {
					setCurrentMutation.mutateAsync({ name, value }).catch(() => {
						console.error('Failed to update variable')
					})
				},

				setPersistenceValue: (name: string, value: boolean) => {
					setPersistenceMutation.mutateAsync({ name, value }).catch(() => {
						console.error('Failed to update variable')
					})
				},

				setDescription: (name: string, description: string) => {
					setDescriptionMutation.mutateAsync({ name, description }).catch(() => {
						console.error('Failed to update variable description')
					})
				},

				doDelete: (name: string) => {
					confirmModalRef.current?.show(
						'Delete variable',
						`Are you sure you want to delete the custom variable "${name}"?`,
						'Delete',
						() => {
							deleteMutation.mutateAsync({ name }).catch(() => {
								console.error('Failed to delete variable')
							})
						}
					)
				},
			}) satisfies CustomVariablesApi,
		[
			setDefaultMutation,
			setCurrentMutation,
			setPersistenceMutation,
			setDescriptionMutation,
			deleteMutation,
			notifier,
			confirmModalRef,
		]
	)
}
