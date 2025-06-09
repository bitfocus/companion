import { useContext, useMemo } from 'react'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal'
import { RootAppStoreContext } from '~/Stores/RootAppStore'

export interface CustomVariablesApi {
	onCopied: () => void
	doDelete: (name: string) => void
	setDescription: (name: string, value: string) => void
	setStartupValue: (name: string, value: any) => void
	setCurrentValue: (name: string, value: any) => void
	setPersistenceValue: (name: string, persisted: boolean) => void
}

export function useCustomVariablesApi(confirmModalRef: React.RefObject<GenericConfirmModalRef>): CustomVariablesApi {
	const { socket, notifier } = useContext(RootAppStoreContext)

	return useMemo(
		() =>
			({
				onCopied: () => {
					notifier.current?.show(`Copied`, 'Copied to clipboard', 5000)
				},

				setStartupValue: (name: string, value: any) => {
					socket.emitPromise('custom-variables:set-default', [name, value]).catch(() => {
						console.error('Failed to update variable')
					})
				},
				setCurrentValue: (name: string, value: any) => {
					socket.emitPromise('custom-variables:set-current', [name, value]).catch(() => {
						console.error('Failed to update variable')
					})
				},

				setPersistenceValue: (name: string, value: boolean) => {
					socket.emitPromise('custom-variables:set-persistence', [name, value]).catch(() => {
						console.error('Failed to update variable')
					})
				},

				setDescription: (name: string, description: string) => {
					socket.emitPromise('custom-variables:set-description', [name, description]).catch(() => {
						console.error('Failed to update variable description')
					})
				},

				doDelete: (name: string) => {
					confirmModalRef.current?.show(
						'Delete variable',
						`Are you sure you want to delete the custom variable "${name}"?`,
						'Delete',
						() => {
							socket.emitPromise('custom-variables:delete', [name]).catch(() => {
								console.error('Failed to delete variable')
							})
						}
					)
				},
			}) satisfies CustomVariablesApi,
		[socket, notifier, confirmModalRef]
	)
}
