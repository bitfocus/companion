import { faCubesStacked } from '@fortawesome/free-solid-svg-icons'
import { useMatchRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef } from 'react'
import { CreateCustomFeedbackControlId, ParseControlId } from '@companion-app/shared/ControlId.js'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import {
	BuildingBlockListPage,
	type BuildingBlockListItem,
	type BuildingBlockListKind,
} from '~/Controls/BuildingBlockListPage.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useCustomFeedbackCollectionsApi } from './CustomFeedbackCollectionsApi'

const CUSTOM_FEEDBACKS_KIND: BuildingBlockListKind = {
	id: 'custom-feedback',
	icon: faCubesStacked,
	noun: 'custom feedback',
	nounTitle: 'Custom Feedback',
	helpPage: '/user-guide/config/custom-feedbacks',
	emptyDescription: (
		<>
			<p>
				Custom feedbacks are combinations of feedbacks you build once and use anywhere, like any other feedback. They
				are true when all of their feedbacks are, and inputs let each use customise what they check.
			</p>
			<p>Use them to keep a condition you repeat on many buttons or triggers in one place.</p>
		</>
	),
	deleteWarning: 'Any feedbacks using it will stop working.',
}

export const CustomFeedbacksPage = observer(function CustomFeedbacksPage() {
	const { customFeedbacksList } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: '/custom-feedbacks' })
	const matchRoute = useMatchRoute()
	// The editor has a child route for each tab
	const routeMatch = matchRoute({ to: '/custom-feedbacks/$controlId', fuzzy: true })
	const selectedId = routeMatch ? routeMatch.controlId : null

	const select = useCallback(
		(customFeedbackId: string | null) => {
			if (customFeedbackId === null) {
				void navigate({ to: '/custom-feedbacks' })
			} else {
				void navigate({ to: `/custom-feedbacks/$controlId`, params: { controlId: customFeedbackId } })
			}
		},
		[navigate]
	)

	const createMutation = useMutationExt(trpc.controls.customFeedbacks.create.mutationOptions())
	const createCollectionMutation = useMutationExt(trpc.controls.customFeedbacks.collections.add.mutationOptions())
	const cloneMutation = useMutationExt(trpc.controls.customFeedbacks.clone.mutationOptions())
	const deleteMutation = useMutationExt(trpc.controls.customFeedbacks.delete.mutationOptions())

	const addNew = useCallback(() => {
		createMutation
			.mutateAsync({ name: 'New custom feedback' })
			.then((controlId) => {
				const parsedId = ParseControlId(controlId)
				if (parsedId?.type === 'custom-feedback') select(parsedId.customFeedbackId)
			})
			.catch((e) => console.error('failed to create custom feedback', e))
	}, [createMutation, select])
	const addCollection = useCallback(() => {
		createCollectionMutation
			.mutateAsync({ collectionName: 'New Collection' })
			.catch((e) => console.error('Failed to add collection', e))
	}, [createCollectionMutation])
	const clone = useCallback(
		(id: string) => {
			cloneMutation
				.mutateAsync({ controlId: CreateCustomFeedbackControlId(id) })
				.catch((e) => console.error('Failed to clone', e))
		},
		[cloneMutation]
	)
	const remove = useCallback(
		(id: string) => {
			deleteMutation
				.mutateAsync({ controlId: CreateCustomFeedbackControlId(id) })
				.catch((e) => console.error('Failed to delete', e))
		},
		[deleteMutation]
	)

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const collectionsApi = useCustomFeedbackCollectionsApi(confirmModalRef)

	const items = useComputed(() => {
		const items: BuildingBlockListItem[] = []
		for (const [controlId, customFeedback] of customFeedbacksList.customFeedbacks) {
			const parsedId = ParseControlId(controlId)
			if (parsedId?.type !== 'custom-feedback') continue
			items.push({
				...customFeedback,
				id: parsedId.customFeedbackId,
				collectionId: customFeedback.collectionId || null,
			})
		}
		return items
	}, [customFeedbacksList.customFeedbacks])

	return (
		<BuildingBlockListPage
			kind={CUSTOM_FEEDBACKS_KIND}
			items={items}
			collections={customFeedbacksList.rootCollections()}
			allCollectionIds={customFeedbacksList.allCollectionIds}
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
