import { faSwatchbook } from '@fortawesome/free-solid-svg-icons'
import { useMatchRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef } from 'react'
import { CreateCustomPresetControlId, ParseControlId } from '@companion-app/shared/ControlId.js'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import {
	BuildingBlockListPage,
	type BuildingBlockListItem,
	type BuildingBlockListKind,
} from '~/Controls/BuildingBlockListPage.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useCustomPresetCollectionsApi } from './CustomPresetCollectionsApi'

const CUSTOM_ELEMENTS_KIND: BuildingBlockListKind = {
	id: 'custom-preset',
	icon: faSwatchbook,
	noun: 'custom preset',
	nounTitle: 'Custom Preset',
	helpPage: '/user-guide/config/custom-presets',
	emptyDescription: (
		<>
			<p>
				Custom presets are buttons you build once and then place from the presets list, like the presets of a
				connection.
			</p>
			<p>
				Place one as a linked preset to have it follow your changes to the custom preset, or as a copy to edit it
				freely.
			</p>
		</>
	),
	deleteWarning: 'Buttons linked to it will keep how they look now, but will no longer follow changes.',
}

export const CustomPresetsPage = observer(function CustomPresetsPage() {
	const { customPresetsList } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: '/custom-presets' })
	const matchRoute = useMatchRoute()
	// The editor has a child route for each tab
	const routeMatch = matchRoute({ to: '/custom-presets/$controlId', fuzzy: true })
	const selectedId = routeMatch ? routeMatch.controlId : null

	const select = useCallback(
		(customPresetId: string | null) => {
			if (customPresetId === null) {
				void navigate({ to: '/custom-presets' })
			} else {
				void navigate({ to: `/custom-presets/$controlId`, params: { controlId: customPresetId } })
			}
		},
		[navigate]
	)

	const createMutation = useMutationExt(trpc.controls.customPresets.create.mutationOptions())
	const createCollectionMutation = useMutationExt(trpc.controls.customPresets.collections.add.mutationOptions())
	const cloneMutation = useMutationExt(trpc.controls.customPresets.clone.mutationOptions())
	const deleteMutation = useMutationExt(trpc.controls.customPresets.delete.mutationOptions())

	const addNew = useCallback(() => {
		createMutation
			.mutateAsync({ name: 'New custom preset' })
			.then((controlId) => {
				const parsedId = ParseControlId(controlId)
				if (parsedId?.type === 'custom-preset') select(parsedId.customPresetId)
			})
			.catch((e) => console.error('failed to create custom preset', e))
	}, [createMutation, select])
	const addCollection = useCallback(() => {
		createCollectionMutation
			.mutateAsync({ collectionName: 'New Collection' })
			.catch((e) => console.error('Failed to add collection', e))
	}, [createCollectionMutation])
	const clone = useCallback(
		(id: string) => {
			cloneMutation
				.mutateAsync({ controlId: CreateCustomPresetControlId(id) })
				.catch((e) => console.error('Failed to clone', e))
		},
		[cloneMutation]
	)
	const remove = useCallback(
		(id: string) => {
			deleteMutation
				.mutateAsync({ controlId: CreateCustomPresetControlId(id) })
				.catch((e) => console.error('Failed to delete', e))
		},
		[deleteMutation]
	)

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const collectionsApi = useCustomPresetCollectionsApi(confirmModalRef)

	const items = useComputed(() => {
		const items: BuildingBlockListItem[] = []
		for (const [controlId, customPreset] of customPresetsList.customPresets) {
			const parsedId = ParseControlId(controlId)
			if (parsedId?.type !== 'custom-preset') continue
			items.push({ ...customPreset, id: parsedId.customPresetId, collectionId: customPreset.collectionId || null })
		}
		return items
	}, [customPresetsList.customPresets])

	return (
		<BuildingBlockListPage
			kind={CUSTOM_ELEMENTS_KIND}
			items={items}
			collections={customPresetsList.rootCollections()}
			allCollectionIds={customPresetsList.allCollectionIds}
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
