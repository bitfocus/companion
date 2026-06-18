import {
	faAdd,
	faClone,
	faDownload,
	faFileExport,
	faLayerGroup,
	faList,
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
import { Button, ButtonGroup, LinkButtonExternal } from '~/Components/Button'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable'
import { ConfirmExportModal, type ConfirmExportModalRef } from '~/Components/ConfirmExportModal.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Grid } from '~/Components/Grid'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { SearchBox } from '~/Components/SearchBox'
import { SwitchInputField } from '~/Components/SwitchInputField'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper'
import { useTwoPanelMode } from '~/Hooks/useLayoutMode'
import { CloseButton, ContextHelpButton } from '~/Layout/PanelIcons'
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

	const showPrimaryPanel = twoPanelMode || !selectedTriggerId
	const showSecondaryPanel = twoPanelMode || !!selectedTriggerId

	return (
		<Grid.Row className="triggers-page split-panels">
			<GenericConfirmModal ref={confirmModalRef} />
			<ConfirmExportModal ref={exportModalRef} title="Export Triggers" />

			<Grid.Col
				xs={twoPanelMode ? 6 : 12}
				className={classnames('primary-panel', showPrimaryPanel ? 'd-block' : 'd-none')}
			>
				<div className="flex-column-layout">
					<div className="fixed-header">
						<h4 className="button-inline">
							Triggers
							<ContextHelpButton action="/user-guide/config/triggers" />
						</h4>
						<p style={{ marginBottom: '0.5rem' }}>
							Triggers allow you to automate Companion by running actions when certain events occur, such as feedback or
							variable updates.
						</p>

						<div className="mb-2">
							<ButtonGroup>
								<Button color="primary" onClick={doAddNew} size="sm">
									<FontAwesomeIcon icon={faAdd} /> Add Trigger
								</Button>
								<CreateCollectionButton />
							</ButtonGroup>

							<Button color="secondary" className="right" size="sm" onClick={showExportModal}>
								<FontAwesomeIcon icon={faFileExport} /> Export all
							</Button>
						</div>

						<SearchBox placeholder="Filter ..." filter={filter} setFilter={setFilter} className="mb-1 mt-2" />
					</div>

					<div className="scrollable-content">
						<PanelCollapseHelperProvider
							storageId="trigger-groups"
							knownPanelIds={triggersList.allCollectionIds}
							defaultCollapsed
						>
							<TriggersTableContextProvider deleteModalRef={confirmModalRef} selectTrigger={selectTrigger}>
								<CollectionsNestingTable<TriggerCollection, TriggerDataWithId>
									// Heading={TriggerListTableHeading}
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
			</Grid.Col>

			<Grid.Col xs={twoPanelMode ? 6 : 12} className={`secondary-panel ${showSecondaryPanel ? 'd-block' : 'd-none'}`}>
				<div className="secondary-panel-simple">
					{!!selectedTriggerId && (
						<TriggerEditPanelHeading doCloseTrigger={doCloseTrigger} twoPanelMode={twoPanelMode} />
					)}
					<Outlet />
				</div>
			</Grid.Col>
		</Grid.Row>
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

	const deleteMutation = useMutationExt(trpc.controls.triggers.delete.mutationOptions())
	const cloneMutation = useMutationExt(trpc.controls.triggers.clone.mutationOptions())

	const setOptionsFieldMutation = useMutationExt(trpc.controls.setOptionsField.mutationOptions())

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
		<div className="flex flex-row align-items-center gap-2 hand">
			<div
				className={classnames('flex flex-column grow', { disabled: triggerOrCollectionDisabled })}
				style={{ minWidth: 0 }}
				onClick={doEdit}
			>
				<b>
					{item.name}
					{item.isRateLimited ? (
						<span
							className="ms-2 text-warning"
							title="This trigger is firing very rapidly and is being rate-limited. This is often caused by an accidental feedback loop, where the trigger's actions change a variable that re-triggers it."
						>
							<FontAwesomeIcon icon={faTriangleExclamation} /> Rate limited
						</span>
					) : null}
				</b>
				<span className="auto-ellipsis" dangerouslySetInnerHTML={descriptionHtml} />
				{item.lastExecuted ? <small>Last run: {dayjs(item.lastExecuted).format(tableDateFormat)}</small> : ''}
			</div>
			<div className="action-buttons w-auto">
				<ButtonGroup className="ms-1">
					<SwitchInputField
						id={undefined}
						value={item.enabled}
						setValue={doEnableDisable}
						tooltip={
							(item.enabled ? 'Disable trigger' : 'Enable trigger') +
							(collectionDisabled ? ' when collection is enabled.' : '')
						}
					/>

					<LinkButtonExternal href={makeAbsolutePath(`/int/export/triggers/single/${item.id}`)} title="Export">
						<FontAwesomeIcon icon={faDownload} />
					</LinkButtonExternal>
					<Button onClick={doClone} title="Clone">
						<FontAwesomeIcon icon={faClone} />
					</Button>
					<Button onClick={doDelete} title="Delete">
						<FontAwesomeIcon icon={faTrash} />
					</Button>
				</ButtonGroup>
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
		<Button color="info" size="sm" onClick={doCreateCollection}>
			<FontAwesomeIcon icon={faLayerGroup} /> Create Collection
		</Button>
	)
}

interface TriggerEditPanelHeadingProps {
	doCloseTrigger: () => void
	twoPanelMode: boolean
}

function TriggerEditPanelHeading({ doCloseTrigger, twoPanelMode }: TriggerEditPanelHeadingProps) {
	return (
		<div className="secondary-panel-simple-header">
			<h4 className="panel-title">Edit Trigger</h4>
			<div className="header-buttons">
				<ContextHelpButton action="/user-guide/config/triggers#configuring">
					Define your trigger here.
				</ContextHelpButton>
				{!twoPanelMode && <CloseButton closeFn={doCloseTrigger} />}
			</div>
		</div>
	)
}
