import { faAdd, faCubes, faLayerGroup, faList, faPlay, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import classnames from 'classnames'
import { single as fuzzySingle } from 'fuzzysort'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef, useState } from 'react'
import { CreateCustomActionControlId, ParseControlId } from '@companion-app/shared/ControlId.js'
import type { ClientCustomActionData, CustomActionCollection } from '@companion-app/shared/Model/CustomActionModel.js'
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
import { useCustomActionCollectionsApi } from './CustomActionCollectionsApi'
import { CustomActionsTableContextProvider, useCustomActionsTableContext } from './CustomActionsTableContext'

export const CustomActionsPage = observer(function CustomActionsPage() {
	const { customActionsList } = useContext(RootAppStoreContext)
	const twoPanelMode = useTwoPanelMode()

	const navigate = useNavigate({ from: '/custom-actions' })

	const createMutation = useMutationExt(trpc.controls.customActions.create.mutationOptions())

	const doAddNew = useCallback(() => {
		createMutation
			.mutateAsync({ name: 'New custom action' })
			.then(async (controlId) => {
				const parsedId = ParseControlId(controlId)
				if (parsedId?.type !== 'custom-action') return

				await navigate({ to: `/custom-actions/${parsedId.customActionId}` })
			})
			.catch((e) => {
				console.error('failed to create custom action', e)
			})
	}, [createMutation, navigate])

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const collectionsApi = useCustomActionCollectionsApi(confirmModalRef)

	const allCustomActions = useComputed(() => {
		const allCustomActions: CustomActionDataWithId[] = []

		for (const [controlId, customAction] of customActionsList.customActions) {
			const parsedId = ParseControlId(controlId)
			if (!parsedId || parsedId.type !== 'custom-action') continue
			allCustomActions.push({
				...customAction,
				id: parsedId.customActionId,
				collectionId: customAction.collectionId || null,
			})
		}

		return allCustomActions
	}, [customActionsList.customActions])

	const [filter, setFilter] = useState('')

	const CustomActionItemRow = (item: CustomActionDataWithId) => {
		// Perform a fuzzy filter to hide irrelevant items
		if (filter) {
			const search = fuzzySingle(filter, item.name)
			if (!search || search.score < 0.5) return null
		}
		return <CustomActionsTableRow item={item} />
	}

	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/custom-actions/$controlId' })
	const selectedCustomActionId = routeMatch ? routeMatch.controlId : null

	const selectCustomAction = useCallback(
		(customActionId: string | null) => {
			if (customActionId === null) {
				void navigate({ to: '/custom-actions' })
			} else {
				void navigate({ to: `/custom-actions/$controlId`, params: { controlId: customActionId } })
			}
		},
		[navigate]
	)

	const doClose = useCallback(() => {
		void navigate({ to: '/custom-actions' })
	}, [navigate])

	const emptyList: PanelEmptyListState | null =
		customActionsList.customActions.size === 0
			? {
					title: 'No custom actions yet',
					description: 'Custom actions are lists of actions which can be reused, with inputs to customise each use.',
					actionLabel: 'Add custom action',
					onAction: doAddNew,
				}
			: null

	return (
		<div className="page-shell">
			<PageHeader icon={faCubes} title="Custom Actions" />

			<SplitPanels.Root
				showing={selectedCustomActionId ? 'secondary' : 'primary'}
				resize={{ storageKey: 'custom-actions' }}
			>
				<GenericConfirmModal ref={confirmModalRef} />

				<SplitPanels.Primary>
					<div className="flex flex-col h-full min-h-0 gap-2">
						<div className="bg-surface-muted/50 border border-border/70 p-3 rounded-lg flex flex-col gap-2.5 shrink-0">
							<div className="flex flex-wrap items-center gap-2">
								<Button color="primary" onClick={doAddNew} size="sm">
									<FontAwesomeIcon icon={faAdd} className="me-1.5" /> Add Custom Action
								</Button>
								<CreateCollectionButton />
							</div>

							<SearchBox
								placeholder="Search custom actions..."
								filter={filter}
								setFilter={setFilter}
								className="w-full h-9"
							/>
						</div>

						<div className="flex-1 min-h-0 scrollable-content list-card">
							<PanelCollapseHelperProvider
								storageId="custom-action-groups"
								knownPanelIds={customActionsList.allCollectionIds}
								defaultCollapsed
							>
								<CustomActionsTableContextProvider
									deleteModalRef={confirmModalRef}
									selectCustomAction={selectCustomAction}
									selectedCustomActionId={selectedCustomActionId}
								>
									<CollectionsNestingTable<CustomActionCollection, CustomActionDataWithId>
										NoContent={CustomActionListNoContent}
										ItemRow={CustomActionItemRow}
										itemName="custom action"
										dragId="custom-action"
										collectionsApi={collectionsApi}
										collections={customActionsList.rootCollections()}
										items={allCustomActions}
										selectedItemId={selectedCustomActionId}
									/>
								</CustomActionsTableContextProvider>
							</PanelCollapseHelperProvider>
						</div>
					</div>
				</SplitPanels.Primary>

				<SplitPanels.Secondary>
					<div className="secondary-panel-simple">
						{!!selectedCustomActionId && (
							<PanelHeader icon={faCubes} title="Edit Custom Action">
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

export interface CustomActionDataWithId extends Omit<ClientCustomActionData, 'collectionId'> {
	id: string
	collectionId: string | null
}

function CustomActionListNoContent() {
	return <NonIdealState icon={faList} text="No custom actions yet" />
}

interface CustomActionsTableRowProps {
	item: CustomActionDataWithId
}

const CustomActionsTableRow = observer(function CustomActionsTableRow({ item }: CustomActionsTableRowProps) {
	const tableContext = useCustomActionsTableContext()
	const isSelected = tableContext.selectedCustomActionId === item.id

	const deleteMutation = useMutationExt(trpc.controls.customActions.delete.mutationOptions())
	const cloneMutation = useMutationExt(trpc.controls.customActions.clone.mutationOptions())
	const testRunMutation = useMutationExt(trpc.controls.customActions.testRun.mutationOptions())

	const { notifier } = useContext(RootAppStoreContext)

	const doTestRun = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			testRunMutation.mutateAsync({ controlId: CreateCustomActionControlId(item.id) }).catch((err) => {
				notifier.show('Test Failed', String(err), 4000)
			})
		},
		[testRunMutation, item.id, notifier]
	)

	const doDelete = useCallback(() => {
		tableContext.deleteModalRef.current?.show(
			'Delete custom action',
			'Are you sure you wish to delete this custom action? Any actions using it will stop working.',
			'Delete',
			() => {
				deleteMutation.mutateAsync({ controlId: CreateCustomActionControlId(item.id) }).catch((e) => {
					console.error('Failed to delete', e)
				})
			}
		)
	}, [deleteMutation, tableContext.deleteModalRef, item.id])
	const doEdit = useCallback(() => {
		tableContext.selectCustomAction(item.id)
	}, [tableContext, item.id])
	const doEditKey = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault()
				tableContext.selectCustomAction(item.id)
			}
		},
		[tableContext, item.id]
	)
	const doClone = useCallback(() => {
		cloneMutation.mutateAsync({ controlId: CreateCustomActionControlId(item.id) }).catch((e) => {
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
				<Button
					variant="ghost"
					size="sm"
					onClick={doTestRun}
					title="Test run, with the default inputs"
					className="p-1.5"
				>
					<FontAwesomeIcon icon={faPlay} className="text-xs" />
				</Button>
				<Button variant="ghost" size="sm" onClick={doClone} title="Clone custom action" className="p-1.5">
					<DuplicateIcon />
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={doDelete}
					title="Delete custom action"
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
	const createMutation = useMutationExt(trpc.controls.customActions.collections.add.mutationOptions())

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
