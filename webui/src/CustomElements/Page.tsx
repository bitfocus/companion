import { faShapes } from '@fortawesome/free-solid-svg-icons'
import { useMatchRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef } from 'react'
import { CreateCustomElementControlId, ParseControlId } from '@companion-app/shared/ControlId.js'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import {
	BuildingBlockListPage,
	type BuildingBlockListItem,
	type BuildingBlockListKind,
} from '~/Controls/BuildingBlockListPage.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useCustomElementCollectionsApi } from './CustomElementCollectionsApi'

const CUSTOM_ELEMENTS_KIND: BuildingBlockListKind = {
	id: 'custom-element',
	icon: faShapes,
	noun: 'custom element',
	nounTitle: 'Custom Element',
	helpPage: '/user-guide/config/custom-elements',
	emptyDescription: (
		<>
			<p>
				Custom elements are groups of elements you build once and use on any button, like any other element. Inputs let
				each use customise what they draw.
			</p>
			<p>Use them to keep a design you repeat on many buttons in one place.</p>
		</>
	),
	deleteWarning: 'Any elements using it will be drawn as missing.',
}

export const CustomElementsPage = observer(function CustomElementsPage() {
	const { customElementsList } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: '/custom-elements' })
	const matchRoute = useMatchRoute()
	// The editor has a child route for each tab
	const routeMatch = matchRoute({ to: '/custom-elements/$controlId', fuzzy: true })
	const selectedId = routeMatch ? routeMatch.controlId : null

	const select = useCallback(
		(customElementId: string | null) => {
			if (customElementId === null) {
				void navigate({ to: '/custom-elements' })
			} else {
				void navigate({ to: `/custom-elements/$controlId`, params: { controlId: customElementId } })
			}
		},
		[navigate]
	)

	const createMutation = useMutationExt(trpc.controls.customElements.create.mutationOptions())
	const createCollectionMutation = useMutationExt(trpc.controls.customElements.collections.add.mutationOptions())
	const cloneMutation = useMutationExt(trpc.controls.customElements.clone.mutationOptions())
	const deleteMutation = useMutationExt(trpc.controls.customElements.delete.mutationOptions())

	const addNew = useCallback(() => {
		createMutation
			.mutateAsync({ name: 'New custom element' })
			.then((controlId) => {
				const parsedId = ParseControlId(controlId)
				if (parsedId?.type === 'custom-element') select(parsedId.customElementId)
			})
			.catch((e) => console.error('failed to create custom element', e))
	}, [createMutation, select])
	const addCollection = useCallback(() => {
		createCollectionMutation
			.mutateAsync({ collectionName: 'New Collection' })
			.catch((e) => console.error('Failed to add collection', e))
	}, [createCollectionMutation])
	const clone = useCallback(
		(id: string) => {
			cloneMutation
				.mutateAsync({ controlId: CreateCustomElementControlId(id) })
				.catch((e) => console.error('Failed to clone', e))
		},
		[cloneMutation]
	)
	const remove = useCallback(
		(id: string) => {
			deleteMutation
				.mutateAsync({ controlId: CreateCustomElementControlId(id) })
				.catch((e) => console.error('Failed to delete', e))
		},
		[deleteMutation]
	)

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const collectionsApi = useCustomElementCollectionsApi(confirmModalRef)

	const items = useComputed(() => {
		const items: BuildingBlockListItem[] = []
		for (const [controlId, customElement] of customElementsList.customElements) {
			const parsedId = ParseControlId(controlId)
			if (parsedId?.type !== 'custom-element') continue
			items.push({ ...customElement, id: parsedId.customElementId, collectionId: customElement.collectionId || null })
		}
		return items
	}, [customElementsList.customElements])

	return (
		<BuildingBlockListPage
			kind={CUSTOM_ELEMENTS_KIND}
			items={items}
			collections={customElementsList.rootCollections()}
			allCollectionIds={customElementsList.allCollectionIds}
			collectionsApi={collectionsApi}
			confirmModalRef={confirmModalRef}
			selectedId={selectedId}
			select={select}
			addNew={addNew}
			addCollection={addCollection}
			clone={clone}
			remove={remove}
			rowActions={null}
		/>
	)
})
