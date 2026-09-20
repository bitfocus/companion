import { faAdd, faClone, faLayerGroup, faList, faSquareRootVariable, faTrash } from '@fortawesome/free-solid-svg-icons'
import '../../Components/VariablesTable.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import classnames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef, useState } from 'react'
import { CreateExpressionVariableControlId, ParseControlId } from '@companion-app/shared/ControlId.js'
import type {
	ClientExpressionVariableData,
	ExpressionVariableCollection,
} from '@companion-app/shared/Model/ExpressionVariableModel.js'
import { Button, ButtonGroup } from '~/Components/Button'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable'
import { CopyButton } from '~/Components/CopyButton'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { SearchBox } from '~/Components/SearchBox'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper'
import { PageHeader } from '~/Layout/PageHeader.js'
import { CloseButton, ContextHelpButton } from '~/Layout/PanelIcons'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { useComputed } from '~/Resources/util'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { VariablesNav } from '../VariablesNav.js'
import { useExpressionVariablesCollectionsApi } from './ExpressionVariablesCollectionsApi'
import {
	ExpressionVariablesTableContextProvider,
	useExpressionVariablesTableContext,
} from './ExpressionVariablesTableContext'

export const ExpressionVariablesPage = observer(function ExpressionVariablesPage() {
	const { expressionVariablesList } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: '/variables/expression' })

	const createMutation = useMutationExt(trpc.controls.expressionVariables.create.mutationOptions())

	const doAddNew = useCallback(
		(_e: React.MouseEvent<HTMLButtonElement>) => {
			createMutation
				.mutateAsync()
				.then(async (controlId) => {
					console.log('created expression variable', controlId)

					const parsedId = ParseControlId(controlId)
					if (parsedId?.type !== 'expression-variable') return

					await navigate({
						to: `/variables/expression/$controlId`,
						params: {
							controlId: parsedId.variableId,
						},
					})
				})
				.catch((e) => {
					console.error('failed to create expression-variable', e)
				})
		},
		[createMutation, navigate]
	)

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const expressionVariablesGroupsApi = useExpressionVariablesCollectionsApi(confirmModalRef)

	const allExpressionVariables = useComputed(() => {
		const allExpressionVariables: ExpressionVariableDataWithId[] = []

		for (const [variableId, variable] of expressionVariablesList.expressionVariables) {
			const parsedId = ParseControlId(variableId)
			if (!parsedId || parsedId.type !== 'expression-variable') continue
			allExpressionVariables.push({ ...variable, id: parsedId.variableId, collectionId: variable.collectionId || null })
		}

		return allExpressionVariables
	}, [expressionVariablesList.expressionVariables])

	const [filter, setFilter] = useState('')

	let filterRegexp: RegExp | null = null
	if (filter) {
		try {
			filterRegexp = new RegExp(filter, 'i')
		} catch (e) {
			console.error('Failed to compile filter regexp:', e)
		}
	}

	const ExpressionVariableItemRow = (item: ExpressionVariableDataWithId) => {
		if (filterRegexp && !item.variableName.match(filterRegexp)) return null

		return <ExpressionVariableTableRow item={item} />
	}

	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/variables/expression/$controlId' })
	const selectedVariableId = routeMatch ? routeMatch.controlId : null

	const selectExpressionVariable = useCallback(
		(variableId: string | null) => {
			if (variableId === null) {
				void navigate({ to: '/variables/expression' })
			} else {
				void navigate({
					to: `/variables/expression/$controlId`,
					params: {
						controlId: variableId,
					},
				})
			}
		},
		[navigate]
	)

	const doCloseVariable = useCallback(() => {
		void navigate({ to: '/variables/expression' })
	}, [navigate])

	return (
		<div className="page-shell">
			<GenericConfirmModal ref={confirmModalRef} />

			<PageHeader
				icon={faSquareRootVariable}
				title="Expression Variables"
				helpAction="/user-guide/config/variables#expression-variables"
			/>

			<VariablesNav activeTab="expression" />

			<SplitPanels.Root
				showing={selectedVariableId ? 'secondary' : 'primary'}
				resize={{ storageKey: 'expression-variables' }}
			>
				<SplitPanels.Primary>
					<div className="flex flex-col h-full min-h-0 gap-2">
						{/* Top Header Card: Toolbar & Search */}
						<div className="bg-surface-muted/50 border border-border/70 p-3 rounded-lg flex flex-col gap-2.5 shrink-0">
							<div className="flex items-center justify-between gap-2 flex-wrap">
								<div className="flex flex-wrap items-center gap-2">
									<Button color="primary" onClick={doAddNew} size="sm">
										<FontAwesomeIcon icon={faAdd} className="me-1.5" /> Add Expression Variable
									</Button>
									<CreateCollectionButton />
								</div>
							</div>

							<SearchBox
								placeholder="Search expression variables..."
								filter={filter}
								setFilter={setFilter}
								className="w-full h-9"
							/>
						</div>

						{/* Expression Variables Table Container */}
						<div className="flex-1 min-h-0 scrollable-content rounded-md border border-border/70 bg-surface">
							<PanelCollapseHelperProvider
								storageId="expression-variable-groups"
								knownPanelIds={expressionVariablesList.allCollectionIds}
								defaultCollapsed
							>
								<ExpressionVariablesTableContextProvider
									deleteModalRef={confirmModalRef}
									selectExpressionVariable={selectExpressionVariable}
									selectedVariableId={selectedVariableId}
								>
									<CollectionsNestingTable<ExpressionVariableCollection, ExpressionVariableDataWithId>
										NoContent={ExpressionVariablesListNoContent}
										ItemRow={ExpressionVariableItemRow}
										itemName="expression variable"
										dragId="expression-variable"
										collectionsApi={expressionVariablesGroupsApi}
										collections={expressionVariablesList.rootCollections()}
										items={allExpressionVariables}
										selectedItemId={selectedVariableId}
									/>
								</ExpressionVariablesTableContextProvider>
							</PanelCollapseHelperProvider>
						</div>
					</div>
				</SplitPanels.Primary>

				<SplitPanels.Secondary>
					<div className="secondary-panel-simple">
						{!!selectedVariableId && <ExpressionVariableEditPanelHeading doCloseVariable={doCloseVariable} />}
						<Outlet />
					</div>
				</SplitPanels.Secondary>
			</SplitPanels.Root>
		</div>
	)
})

export interface ExpressionVariableDataWithId extends Omit<ClientExpressionVariableData, 'collectionId'> {
	id: string
	collectionId: string | null
}

function ExpressionVariablesListNoContent() {
	return <NonIdealState icon={faList} text="There are currently no expression variables." />
}

interface ExpressionVariableTableRowProps {
	item: ExpressionVariableDataWithId
}

const ExpressionVariableTableRow = observer(function ExpressionVariableTableRow2({
	item,
}: ExpressionVariableTableRowProps) {
	const tableContext = useExpressionVariablesTableContext()
	const isSelected = tableContext.selectedVariableId === item.id

	const deleteMutation = useMutationExt(trpc.controls.expressionVariables.delete.mutationOptions())
	const cloneMutation = useMutationExt(trpc.controls.expressionVariables.clone.mutationOptions())

	const doDelete = useCallback(() => {
		tableContext.deleteModalRef.current?.show(
			'Delete expression variable',
			'Are you sure you wish to delete this expression variable?',
			'Delete',
			() => {
				deleteMutation.mutateAsync({ controlId: CreateExpressionVariableControlId(item.id) }).catch((e) => {
					console.error('Failed to delete', e)
				})
			}
		)
	}, [deleteMutation, tableContext.deleteModalRef, item.id])

	const doEdit = useCallback(
		(e: React.MouseEvent) => {
			// The row's own buttons (copy, clone, delete) shouldn't also open the editor
			if ((e.target as HTMLElement).closest('button, a')) return
			tableContext.selectExpressionVariable(item.id)
		},
		[tableContext, item.id]
	)
	const doEditKey = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.target !== e.currentTarget) return
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault()
				tableContext.selectExpressionVariable(item.id)
			}
		},
		[tableContext, item.id]
	)

	const doClone = useCallback(() => {
		cloneMutation
			.mutateAsync({ controlId: CreateExpressionVariableControlId(item.id) })
			.then((newControlId) => {
				console.log('cloned to control', newControlId)
			})
			.catch((e) => {
				console.error('Failed to clone', e)
			})
	}, [cloneMutation, item.id])

	const fullname = item.variableName ? `$(expression:${item.variableName})` : null

	return (
		<div
			role="button"
			tabIndex={0}
			onClick={doEdit}
			onKeyDown={doEditKey}
			className={classnames(
				'flex flex-row items-center gap-3 cursor-pointer py-2 px-3 rounded-lg transition-colors hover:bg-surface-muted/50',
				isSelected
					? 'bg-primary/10 font-semibold text-primary border-l-4 border-l-primary rounded-l-none'
					: 'bg-transparent'
			)}
		>
			<div className="flex flex-col grow min-w-0">
				{fullname ? (
					<span className="variable-style flex items-center gap-1.5 truncate">
						<span>{fullname}</span>
						<CopyButton size="sm" title="Copy variable name" color="primary" variant="ghost" text={fullname} />
					</span>
				) : (
					<b className="text-sm text-body">Unnamed</b>
				)}

				<span className="text-xs text-muted truncate">{item.description ?? ''}</span>
			</div>

			<div className="shrink-0 flex items-center gap-1">
				<ButtonGroup>
					<Button color="secondary" size="sm" onClick={doClone} title="Clone">
						<FontAwesomeIcon icon={faClone} />
					</Button>
					<Button
						color="secondary"
						size="sm"
						onClick={doDelete}
						title="Delete"
						className="text-rose-500 hover:bg-rose-500/10"
					>
						<FontAwesomeIcon icon={faTrash} />
					</Button>
				</ButtonGroup>
			</div>
		</div>
	)
})

function CreateCollectionButton() {
	const createMutation = useMutationExt(trpc.controls.expressionVariables.collections.add.mutationOptions())

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

interface ExpressionVariableEditPanelHeadingProps {
	doCloseVariable: () => void
}

function ExpressionVariableEditPanelHeading({ doCloseVariable }: ExpressionVariableEditPanelHeadingProps) {
	return (
		<div className="flex items-center justify-between gap-3 p-3 bg-surface-muted/40 border-b border-border/70 shrink-0">
			<div className="flex items-center gap-2">
				<span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-surface-muted text-muted text-xs">
					<FontAwesomeIcon icon={faSquareRootVariable} />
				</span>
				<h3 className="text-sm font-bold text-body mb-0">Edit Expression Variable</h3>
			</div>
			<div className="flex items-center gap-1.5">
				<ContextHelpButton action="/user-guide/config/variables#expression-variables" />
				<CloseButton closeFn={doCloseVariable} />
			</div>
		</div>
	)
}
