import { faCubes, faPlay } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useMatchRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef } from 'react'
import { CreateCustomActionControlId, ParseControlId } from '@companion-app/shared/ControlId.js'
import { Button } from '~/Components/Button.js'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import {
	BuildingBlockListPage,
	type BuildingBlockListItem,
	type BuildingBlockListKind,
} from '~/Controls/BuildingBlockListPage.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useCustomActionCollectionsApi } from './CustomActionCollectionsApi'

const CUSTOM_ACTIONS_KIND: BuildingBlockListKind = {
	id: 'custom-action',
	icon: faCubes,
	noun: 'custom action',
	nounTitle: 'Custom Action',
	helpPage: '/user-guide/config/custom-actions',
	emptyDescription: (
		<>
			<p>
				Custom actions are lists of actions you build once and use anywhere, like any other action. Inputs let each use
				customise what it does, and outputs hand results back to it.
			</p>
			<p>Use them to keep a sequence you repeat on many buttons or triggers in one place.</p>
		</>
	),
	deleteWarning: 'Any actions using it will stop working.',
}

export const CustomActionsPage = observer(function CustomActionsPage() {
	const { customActionsList } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: '/custom-actions' })
	const matchRoute = useMatchRoute()
	// The editor has a child route for each tab
	const routeMatch = matchRoute({ to: '/custom-actions/$controlId', fuzzy: true })
	const selectedId = routeMatch ? routeMatch.controlId : null

	const select = useCallback(
		(customActionId: string | null) => {
			if (customActionId === null) {
				void navigate({ to: '/custom-actions' })
			} else {
				void navigate({ to: `/custom-actions/$controlId`, params: { controlId: customActionId } })
			}
		},
		[navigate]
	)

	const createMutation = useMutationExt(trpc.controls.customActions.create.mutationOptions())
	const createCollectionMutation = useMutationExt(trpc.controls.customActions.collections.add.mutationOptions())
	const cloneMutation = useMutationExt(trpc.controls.customActions.clone.mutationOptions())
	const deleteMutation = useMutationExt(trpc.controls.customActions.delete.mutationOptions())

	const addNew = useCallback(() => {
		createMutation
			.mutateAsync({ name: 'New custom action' })
			.then((controlId) => {
				const parsedId = ParseControlId(controlId)
				if (parsedId?.type === 'custom-action') select(parsedId.customActionId)
			})
			.catch((e) => console.error('failed to create custom action', e))
	}, [createMutation, select])
	const addCollection = useCallback(() => {
		createCollectionMutation
			.mutateAsync({ collectionName: 'New Collection' })
			.catch((e) => console.error('Failed to add collection', e))
	}, [createCollectionMutation])
	const clone = useCallback(
		(id: string) => {
			cloneMutation
				.mutateAsync({ controlId: CreateCustomActionControlId(id) })
				.catch((e) => console.error('Failed to clone', e))
		},
		[cloneMutation]
	)
	const remove = useCallback(
		(id: string) => {
			deleteMutation
				.mutateAsync({ controlId: CreateCustomActionControlId(id) })
				.catch((e) => console.error('Failed to delete', e))
		},
		[deleteMutation]
	)

	const { notifier } = useContext(RootAppStoreContext)
	const testRunMutation = useMutationExt(trpc.controls.customActions.testRun.mutationOptions())
	const rowActions = useCallback(
		(item: BuildingBlockListItem) => (
			<Button
				variant="ghost"
				size="sm"
				onClick={(e) => {
					e.stopPropagation()
					testRunMutation.mutateAsync({ controlId: CreateCustomActionControlId(item.id) }).catch((err) => {
						notifier.show('Test Failed', String(err), 4000)
					})
				}}
				title="Test run, with the default inputs"
				className="p-1.5"
			>
				<FontAwesomeIcon icon={faPlay} className="text-xs" />
			</Button>
		),
		[testRunMutation, notifier]
	)

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const collectionsApi = useCustomActionCollectionsApi(confirmModalRef)

	const items = useComputed(() => {
		const items: BuildingBlockListItem[] = []
		for (const [controlId, customAction] of customActionsList.customActions) {
			const parsedId = ParseControlId(controlId)
			if (parsedId?.type !== 'custom-action') continue
			items.push({ ...customAction, id: parsedId.customActionId, collectionId: customAction.collectionId || null })
		}
		return items
	}, [customActionsList.customActions])

	return (
		<BuildingBlockListPage
			kind={CUSTOM_ACTIONS_KIND}
			items={items}
			collections={customActionsList.rootCollections()}
			allCollectionIds={customActionsList.allCollectionIds}
			collectionsApi={collectionsApi}
			confirmModalRef={confirmModalRef}
			selectedId={selectedId}
			select={select}
			addNew={addNew}
			addCollection={addCollection}
			clone={clone}
			remove={remove}
			rowActions={rowActions}
		/>
	)
})
