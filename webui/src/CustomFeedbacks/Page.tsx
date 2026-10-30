import { faAdd, faCubesStacked, faLayerGroup, faList, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import classnames from 'classnames'
import { single as fuzzySingle } from 'fuzzysort'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef, useState } from 'react'
import { CreateCustomFeedbackControlId, ParseControlId } from '@companion-app/shared/ControlId.js'
import type {
	ClientCustomFeedbackData,
	CustomFeedbackCollection,
} from '@companion-app/shared/Model/CustomFeedbackModel.js'
import { Button } from '~/Components/Button'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable'
import { DuplicateIcon } from '~/Components/DuplicateIcon.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { SearchBox } from '~/Components/SearchBox'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper'
import { useTwoPanelMode } from '~/Hooks/useLayoutMode'
import { PageHeader } from '~/Layout/PageHeader'
import { PanelEmptyListProvider, type PanelEmptyListState } from '~/Layout/PanelEmptyState.js'
import { PanelHeader } from '~/Layout/PanelHeader.js'
import { CloseButton } from '~/Layout/PanelIcons'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useCustomFeedbackCollectionsApi } from './CustomFeedbackCollectionsApi'
import { CustomFeedbacksTableContextProvider, useCustomFeedbacksTableContext } from './CustomFeedbacksTableContext'

export const CustomFeedbacksPage = observer(function CustomFeedbacksPage() {
	const { customFeedbacksList } = useContext(RootAppStoreContext)
	const twoPanelMode = useTwoPanelMode()

	const navigate = useNavigate({ from: '/custom-feedbacks' })

	const createMutation = useMutationExt(trpc.controls.customFeedbacks.create.mutationOptions())

	const doAddNew = useCallback(() => {
		createMutation
			.mutateAsync({ name: 'New custom feedback' })
			.then(async (controlId) => {
				const parsedId = ParseControlId(controlId)
				if (parsedId?.type !== 'custom-feedback') return

				await navigate({ to: `/custom-feedbacks/${parsedId.customFeedbackId}` })
			})
			.catch((e) => {
				console.error('failed to create custom feedback', e)
			})
	}, [createMutation, navigate])

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const collectionsApi = useCustomFeedbackCollectionsApi(confirmModalRef)

	const allCustomFeedbacks = useComputed(() => {
		const allCustomFeedbacks: CustomFeedbackDataWithId[] = []

		for (const [controlId, customFeedback] of customFeedbacksList.customFeedbacks) {
			const parsedId = ParseControlId(controlId)
			if (!parsedId || parsedId.type !== 'custom-feedback') continue
			allCustomFeedbacks.push({
				...customFeedback,
				id: parsedId.customFeedbackId,
				collectionId: customFeedback.collectionId || null,
			})
		}

		return allCustomFeedbacks
	}, [customFeedbacksList.customFeedbacks])

	const [filter, setFilter] = useState('')

	const CustomFeedbackItemRow = (item: CustomFeedbackDataWithId) => {
		// Perform a fuzzy filter to hide irrelevant items
		if (filter) {
			const search = fuzzySingle(filter, item.name)
			if (!search || search.score < 0.5) return null
		}
		return <CustomFeedbacksTableRow item={item} />
	}

	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/custom-feedbacks/$controlId' })
	const selectedCustomFeedbackId = routeMatch ? routeMatch.controlId : null

	const selectCustomFeedback = useCallback(
		(customFeedbackId: string | null) => {
			if (customFeedbackId === null) {
				void navigate({ to: '/custom-feedbacks' })
			} else {
				void navigate({ to: `/custom-feedbacks/$controlId`, params: { controlId: customFeedbackId } })
			}
		},
		[navigate]
	)

	const doClose = useCallback(() => {
		void navigate({ to: '/custom-feedbacks' })
	}, [navigate])

	const emptyList: PanelEmptyListState | null =
		customFeedbacksList.customFeedbacks.size === 0
			? {
					title: 'No custom feedbacks yet',
					description:
						'Custom feedbacks are combinations of feedbacks which can be reused, with inputs to customise each use.',
					actionLabel: 'Add custom feedback',
					onAction: doAddNew,
				}
			: null

	return (
		<div className="page-shell">
			<PageHeader icon={faCubesStacked} title="Custom Feedbacks" />

			<SplitPanels.Root
				showing={selectedCustomFeedbackId ? 'secondary' : 'primary'}
				resize={{ storageKey: 'custom-feedbacks' }}
			>
				<GenericConfirmModal ref={confirmModalRef} />

				<SplitPanels.Primary>
					<div className="flex flex-col h-full min-h-0 gap-2">
						<div className="bg-surface-muted/50 border border-border/70 p-3 rounded-lg flex flex-col gap-2.5 shrink-0">
							<div className="flex flex-wrap items-center gap-2">
								<Button color="primary" onClick={doAddNew} size="sm">
									<FontAwesomeIcon icon={faAdd} className="me-1.5" /> Add Custom Feedback
								</Button>
								<CreateCollectionButton />
							</div>

							<SearchBox
								placeholder="Search custom feedbacks..."
								filter={filter}
								setFilter={setFilter}
								className="w-full h-9"
							/>
						</div>

						<div className="flex-1 min-h-0 scrollable-content list-card">
							<PanelCollapseHelperProvider
								storageId="custom-feedback-groups"
								knownPanelIds={customFeedbacksList.allCollectionIds}
								defaultCollapsed
							>
								<CustomFeedbacksTableContextProvider
									deleteModalRef={confirmModalRef}
									selectCustomFeedback={selectCustomFeedback}
									selectedCustomFeedbackId={selectedCustomFeedbackId}
								>
									<CollectionsNestingTable<CustomFeedbackCollection, CustomFeedbackDataWithId>
										NoContent={CustomFeedbackListNoContent}
										ItemRow={CustomFeedbackItemRow}
										itemName="custom feedback"
										dragId="custom-feedback"
										collectionsApi={collectionsApi}
										collections={customFeedbacksList.rootCollections()}
										items={allCustomFeedbacks}
										selectedItemId={selectedCustomFeedbackId}
									/>
								</CustomFeedbacksTableContextProvider>
							</PanelCollapseHelperProvider>
						</div>
					</div>
				</SplitPanels.Primary>

				<SplitPanels.Secondary>
					<div className="secondary-panel-simple">
						{!!selectedCustomFeedbackId && (
							<PanelHeader icon={faCubesStacked} title="Edit Custom Feedback">
								{!twoPanelMode && <CloseButton closeFn={doClose} />}
							</PanelHeader>
						)}
						<PanelEmptyListProvider value={emptyList}>
							<Outlet />
						</PanelEmptyListProvider>
					</div>
				</SplitPanels.Secondary>
			</SplitPanels.Root>
		</div>
	)
})

export interface CustomFeedbackDataWithId extends Omit<ClientCustomFeedbackData, 'collectionId'> {
	id: string
	collectionId: string | null
}

function CustomFeedbackListNoContent() {
	return <NonIdealState icon={faList} text="No custom feedbacks yet" />
}

interface CustomFeedbacksTableRowProps {
	item: CustomFeedbackDataWithId
}

const CustomFeedbacksTableRow = observer(function CustomFeedbacksTableRow({ item }: CustomFeedbacksTableRowProps) {
	const tableContext = useCustomFeedbacksTableContext()
	const isSelected = tableContext.selectedCustomFeedbackId === item.id

	const deleteMutation = useMutationExt(trpc.controls.customFeedbacks.delete.mutationOptions())
	const cloneMutation = useMutationExt(trpc.controls.customFeedbacks.clone.mutationOptions())
	const doDelete = useCallback(() => {
		tableContext.deleteModalRef.current?.show(
			'Delete custom feedback',
			'Are you sure you wish to delete this custom feedback? Any feedbacks using it will stop working.',
			'Delete',
			() => {
				deleteMutation.mutateAsync({ controlId: CreateCustomFeedbackControlId(item.id) }).catch((e) => {
					console.error('Failed to delete', e)
				})
			}
		)
	}, [deleteMutation, tableContext.deleteModalRef, item.id])
	const doEdit = useCallback(() => {
		tableContext.selectCustomFeedback(item.id)
	}, [tableContext, item.id])
	const doEditKey = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault()
				tableContext.selectCustomFeedback(item.id)
			}
		},
		[tableContext, item.id]
	)
	const doClone = useCallback(() => {
		cloneMutation.mutateAsync({ controlId: CreateCustomFeedbackControlId(item.id) }).catch((e) => {
			console.error('Failed to clone', e)
		})
	}, [cloneMutation, item.id])

	return (
		<div
			className={classnames(
				'list-row group flex flex-row items-center gap-3 py-2 pe-3',
				isSelected ? 'list-row-selected' : 'hover:bg-surface-muted/60'
			)}
		>
			<div role="button" tabIndex={0} className="flex flex-col grow min-w-0" onClick={doEdit} onKeyDown={doEditKey}>
				<span className="truncate text-sm font-semibold text-body">{item.name}</span>
				{item.description && <span className="truncate text-xs text-muted/80 mt-0.5">{item.description}</span>}
			</div>

			<div className="shrink-0 flex items-center gap-1">
				<Button variant="ghost" size="sm" onClick={doClone} title="Clone custom feedback" className="p-1.5">
					<DuplicateIcon />
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={doDelete}
					title="Delete custom feedback"
					className="p-1.5"
					color="danger"
				>
					<FontAwesomeIcon icon={faTrash} className="text-xs" />
				</Button>
			</div>
		</div>
	)
})

function CreateCollectionButton() {
	const createMutation = useMutationExt(trpc.controls.customFeedbacks.collections.add.mutationOptions())

	const doCreateCollection = useCallback(() => {
		createMutation.mutateAsync({ collectionName: 'New Collection' }).catch((e) => {
			console.error('Failed to add collection', e)
		})
	}, [createMutation])

	return (
		<Button color="secondary" size="sm" onClick={doCreateCollection}>
			<FontAwesomeIcon icon={faLayerGroup} className="me-1.5" /> Create Collection
		</Button>
	)
}
