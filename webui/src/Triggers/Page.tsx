import {
	faAdd,
	faClock,
	faClone,
	faDownload,
	faFileExport,
	faLayerGroup,
	faList,
	faPlay,
	faTrash,
	faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import classnames from 'classnames'
import dayjs from 'dayjs'
import { single as fuzzySingle } from 'fuzzysort'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useMemo, useRef, useState } from 'react'
import { CreateTriggerControlId, ParseControlId } from '@companion-app/shared/ControlId.js'
import type { ClientTriggerData, TriggerCollection } from '@companion-app/shared/Model/TriggerModel.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { Button, LinkButtonExternal } from '~/Components/Button'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable'
import { ConfirmExportModal, type ConfirmExportModalRef } from '~/Components/ConfirmExportModal.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { SearchBox } from '~/Components/SearchBox'
import { SwitchInputField } from '~/Components/SwitchInputField'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper'
import { useTwoPanelMode } from '~/Hooks/useLayoutMode'
import { PageHeader } from '~/Layout/PageHeader'
import { CloseButton, ContextHelpButton } from '~/Layout/PanelIcons'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { sanitizeHtmlString } from '~/Resources/SanitizeHtml.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { makeAbsolutePath, useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useTriggerCollectionsApi } from './TriggerCollectionsApi'
import { TriggersTableContextProvider, useTriggersTableContext } from './TriggersTableContext'

export const TriggersPage = observer(function Triggers() {
	const { triggersList } = useContext(RootAppStoreContext)
	const twoPanelMode = useTwoPanelMode()

	const navigate = useNavigate({ from: '/triggers' })

	const createMutation = useMutationExt(trpc.controls.triggers.create.mutationOptions())

	const doAddNew = useCallback(() => {
		createMutation
			.mutateAsync()
			.then(async (controlId) => {
				console.log('created trigger', controlId)

				const parsedId = ParseControlId(controlId)
				if (parsedId?.type !== 'trigger') return

				await navigate({ to: `/triggers/${parsedId.trigger}` })
			})
			.catch((e) => {
				console.error('failed to create trigger', e)
			})
	}, [createMutation, navigate])

	const exportModalRef = useRef<ConfirmExportModalRef>(null)
	const showExportModal = useCallback(() => {
		exportModalRef.current?.show(makeAbsolutePath(`/int/export/triggers/all`))
	}, [])

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const triggerGroupsApi = useTriggerCollectionsApi(confirmModalRef)

	const allTriggers = useComputed(() => {
		const allTriggers: TriggerDataWithId[] = []

		for (const [triggerId, trigger] of triggersList.triggers) {
			const parsedId = ParseControlId(triggerId)
			if (!parsedId || parsedId.type !== 'trigger') continue
			allTriggers.push({ ...trigger, id: parsedId.trigger, collectionId: trigger.collectionId || null })
		}

		return allTriggers
	}, [triggersList.triggers])

	const [filter, setFilter] = useState('')

	const TriggerItemRow = (item: TriggerDataWithId) => {
		// Perform a fuzzy filter to hide irrelevant items
		if (filter) {
			const search = fuzzySingle(filter, item.name)
			if (!search || search.score < 0.5) return null
		}
		return <TriggersTableRow item={item} />
	}

	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/triggers/$controlId' })
	const selectedTriggerId = routeMatch ? routeMatch.controlId : null

	const selectTrigger = useCallback(
		(triggerId: string | null) => {
			if (triggerId === null) {
				void navigate({ to: '/triggers' })
			} else {
				void navigate({
					to: `/triggers/$controlId`,
					params: {
						controlId: triggerId,
					},
				})
			}
		},
		[navigate]
	)

	const doCloseTrigger = useCallback(() => {
		void navigate({ to: '/triggers' })
	}, [navigate])

	return (
		<div className="page-shell">
			<PageHeader icon={faClock} title="Triggers" helpAction="/user-guide/config/triggers" />

			<SplitPanels.Root showing={selectedTriggerId ? 'secondary' : 'primary'} resize={{ storageKey: 'triggers' }}>
				<GenericConfirmModal ref={confirmModalRef} />
				<ConfirmExportModal ref={exportModalRef} title="Export Triggers" />

				<SplitPanels.Primary>
					<div className="flex flex-col h-full min-h-0 gap-2">
						{/* Top Header Card: Toolbar & Search */}
						<div className="bg-surface-muted/50 border border-border/70 p-3 rounded-lg flex flex-col gap-2.5 shrink-0">
							<div className="flex items-center justify-between gap-2 flex-wrap">
								<div className="flex flex-wrap items-center gap-2">
									<Button color="primary" onClick={doAddNew} size="sm">
										<FontAwesomeIcon icon={faAdd} className="me-1.5" /> Add Trigger
									</Button>
									<CreateCollectionButton />
								</div>

								<Button color="secondary" size="sm" onClick={showExportModal}>
									<FontAwesomeIcon icon={faFileExport} className="me-1.5" /> Export All
								</Button>
							</div>

							<SearchBox
								placeholder="Search triggers (e.g. Schedule, Variable, Button)..."
								filter={filter}
								setFilter={setFilter}
								className="w-full h-9"
							/>
						</div>

						{/* Triggers Table Container */}
						<div className="flex-1 min-h-0 scrollable-content list-card">
							<PanelCollapseHelperProvider
								storageId="trigger-groups"
								knownPanelIds={triggersList.allCollectionIds}
								defaultCollapsed
							>
								<TriggersTableContextProvider
									deleteModalRef={confirmModalRef}
									selectTrigger={selectTrigger}
									selectedTriggerId={selectedTriggerId}
								>
									<CollectionsNestingTable<TriggerCollection, TriggerDataWithId>
										NoContent={TriggerListNoContent}
										ItemRow={TriggerItemRow}
										GroupHeaderContent={TriggerGroupHeaderContent}
										itemName="trigger"
										dragId="trigger"
										collectionsApi={triggerGroupsApi}
										collections={triggersList.rootCollections()}
										items={allTriggers}
										selectedItemId={selectedTriggerId}
									/>
								</TriggersTableContextProvider>
							</PanelCollapseHelperProvider>
						</div>
					</div>
				</SplitPanels.Primary>

				<SplitPanels.Secondary>
					<div className="secondary-panel-simple">
						{!!selectedTriggerId && (
							<TriggerEditPanelHeading
								doCloseTrigger={doCloseTrigger}
								twoPanelMode={twoPanelMode}
								controlId={CreateTriggerControlId(selectedTriggerId)}
							/>
						)}
						<Outlet />
					</div>
				</SplitPanels.Secondary>
			</SplitPanels.Root>
		</div>
	)
})

export interface TriggerDataWithId extends Omit<ClientTriggerData, 'collectionId'> {
	id: string
	collectionId: string | null
}

const tableDateFormat = 'MM/DD HH:mm:ss'

function TriggerListNoContent() {
	return <NonIdealState icon={faList} text="There are currently no triggers or scheduled tasks." />
}

// Item row rendering is provided inline in the component to allow filtering

function TriggerGroupHeaderContent({ collection }: { collection: TriggerCollection }) {
	const setEnabledMutation = useMutationExt(trpc.controls.triggers.collections.setEnabled.mutationOptions())

	const setEnabled = useCallback(
		(enabled: boolean) => {
			setEnabledMutation.mutateAsync({ collectionId: collection.id, enabled }).catch((e) => {
				console.error('Failed to reorder collection', stringifyError(e))
			})
		},
		[setEnabledMutation, collection.id]
	)

	return (
		<div className="ms-1">
			<SwitchInputField
				id={undefined}
				value={collection.metaData.enabled}
				setValue={setEnabled}
				tooltip={collection.metaData.enabled ? 'Disable collection' : 'Enable collection'}
			/>
		</div>
	)
}

interface TriggersTableRowProps {
	item: TriggerDataWithId
}

const TriggersTableRow = observer(function TriggersTableRow2({ item }: TriggersTableRowProps) {
	const tableContext = useTriggersTableContext()
	const isSelected = tableContext.selectedTriggerId === item.id

	const deleteMutation = useMutationExt(trpc.controls.triggers.delete.mutationOptions())
	const cloneMutation = useMutationExt(trpc.controls.triggers.clone.mutationOptions())

	const setOptionsFieldMutation = useMutationExt(trpc.controls.setOptionsField.mutationOptions())

	const { notifier } = useContext(RootAppStoreContext)
	const testActionsMutation = useMutationExt(trpc.controls.triggers.testActions.mutationOptions())

	const doTestRun = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			const controlId = CreateTriggerControlId(item.id)
			testActionsMutation
				.mutateAsync({ controlId })
				.then(() => {
					notifier.show('Trigger Tested', `Fired trigger "${item.name}"`, 3000)
				})
				.catch((err) => {
					notifier.show('Test Failed', String(err), 4000)
				})
		},
		[testActionsMutation, item.id, item.name, notifier]
	)

	const doEnableDisable = useCallback(
		(enabled: boolean) => {
			setOptionsFieldMutation
				.mutateAsync({
					controlId: CreateTriggerControlId(item.id),
					key: 'enabled',
					value: enabled,
				})
				.catch((e) => {
					console.error('failed to toggle trigger state', e)
				})
		},
		[setOptionsFieldMutation, item.id]
	)

	const doDelete = useCallback(() => {
		tableContext.deleteModalRef.current?.show(
			'Delete trigger',
			'Are you sure you wish to delete this trigger?',
			'Delete',
			() => {
				deleteMutation.mutateAsync({ controlId: CreateTriggerControlId(item.id) }).catch((e) => {
					console.error('Failed to delete', e)
				})
			}
		)
	}, [deleteMutation, tableContext.deleteModalRef, item.id])
	const doEdit = useCallback(() => {
		tableContext.selectTrigger(item.id)
	}, [tableContext, item.id])
	const doEditKey = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault()
				tableContext.selectTrigger(item.id)
			}
		},
		[tableContext, item.id]
	)
	const doClone = useCallback(() => {
		cloneMutation
			.mutateAsync({ controlId: CreateTriggerControlId(item.id) })
			.then((newControlId) => {
				console.log('cloned to control', newControlId)
			})
			.catch((e) => {
				console.error('Failed to clone', e)
			})
	}, [cloneMutation, item.id])

	const descriptionHtml = useMemo(
		() => ({
			__html: sanitizeHtmlString(item.description || 'No events'),
		}),
		[item.description]
	)

	const collectionDisabled = !(item.collectionEnabled ?? true)
	const triggerOrCollectionDisabled = !item.enabled || collectionDisabled

	return (
		<div
			className={classnames(
				'group flex flex-row items-center gap-3 cursor-pointer py-2 px-3 rounded-lg transition-all',
				isSelected
					? 'bg-primary/10 font-semibold text-primary ring-1 ring-primary/30 shadow-xs'
					: 'hover:bg-surface-muted/60'
			)}
		>
			<div
				role="button"
				tabIndex={0}
				className={classnames('flex flex-col grow min-w-0', { 'opacity-60': triggerOrCollectionDisabled })}
				onClick={doEdit}
				onKeyDown={doEditKey}
			>
				<div className="truncate text-sm font-semibold text-body flex items-center gap-2">
					<span>{item.name}</span>
					{item.enabled && !collectionDisabled && (
						<span className="text-3xs font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
							Active
						</span>
					)}
					{item.isRateLimited && (
						<span
							className="text-amber-500 font-normal text-xs flex items-center gap-1"
							title="This trigger is firing very rapidly and is being rate-limited."
						>
							<FontAwesomeIcon icon={faTriangleExclamation} /> Rate limited
						</span>
					)}
				</div>
				<span className="truncate text-xs text-muted/80 font-normal mt-0.5" dangerouslySetInnerHTML={descriptionHtml} />
				{item.lastExecuted && (
					<small className="text-3xs tabular-nums text-muted/70 mt-0.5">
						Last run: {dayjs(item.lastExecuted).format(tableDateFormat)}
					</small>
				)}
			</div>

			<div className="shrink-0 flex items-center gap-2">
				<SwitchInputField
					id={undefined}
					value={item.enabled}
					setValue={doEnableDisable}
					tooltip={
						(item.enabled ? 'Disable trigger' : 'Enable trigger') +
						(collectionDisabled ? ' when collection is enabled.' : '')
					}
				/>

				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={doTestRun}
						title="Test Run Trigger (Fire actions now)"
						className="text-muted hover:text-emerald-600 p-1.5"
					>
						<FontAwesomeIcon icon={faPlay} className="text-xs" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={doClone}
						title="Clone Trigger"
						className="text-muted hover:text-body p-1.5"
					>
						<FontAwesomeIcon icon={faClone} className="text-xs" />
					</Button>
					<LinkButtonExternal
						variant="ghost"
						size="sm"
						href={makeAbsolutePath(`/int/export/triggers/single/${item.id}`)}
						title="Export Trigger"
						className="text-muted hover:text-body p-1.5"
					>
						<FontAwesomeIcon icon={faDownload} className="text-xs" />
					</LinkButtonExternal>
					<Button
						variant="ghost"
						size="sm"
						onClick={doDelete}
						title="Delete Trigger"
						className="text-muted hover:text-rose-500 p-1.5"
					>
						<FontAwesomeIcon icon={faTrash} className="text-xs" />
					</Button>
				</div>
			</div>
		</div>
	)
})

function CreateCollectionButton() {
	const createMutation = useMutationExt(trpc.controls.triggers.collections.add.mutationOptions())

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

interface TriggerEditPanelHeadingProps {
	doCloseTrigger: () => void
	twoPanelMode: boolean
	controlId: string
}

function TriggerEditPanelHeading({ doCloseTrigger, twoPanelMode, controlId }: TriggerEditPanelHeadingProps) {
	return (
		<div className="flex items-center justify-between gap-3 p-3 bg-surface-muted/40 border-b border-border/70 shrink-0">
			<div className="flex items-center gap-2 min-w-0">
				<span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-surface-muted text-muted text-xs shrink-0">
					<FontAwesomeIcon icon={faClock} />
				</span>
				<h3 className="text-sm font-bold text-body mb-0 truncate">Edit Trigger</h3>
			</div>
			<div className="flex items-center gap-2 shrink-0">
				<TestActionsHeaderButton controlId={controlId} />
				<ContextHelpButton action="/user-guide/config/triggers#configuring">
					Define your trigger here.
				</ContextHelpButton>
				{!twoPanelMode && <CloseButton closeFn={doCloseTrigger} />}
			</div>
		</div>
	)
}

function TestActionsHeaderButton({ controlId }: { controlId: string }): React.JSX.Element {
	const testActionsMutation = useMutationExt(trpc.controls.triggers.testActions.mutationOptions())

	const hotPressDown = useCallback(() => {
		testActionsMutation.mutateAsync({ controlId }).catch((e) => console.error(`Hot press failed: ${e}`))
	}, [testActionsMutation, controlId])

	return (
		<Button color="warning" size="sm" onClick={hotPressDown} title="Test actions for this trigger">
			<FontAwesomeIcon icon={faPlay} className="me-1.5 text-xs" />
			Test Actions
		</Button>
	)
}
