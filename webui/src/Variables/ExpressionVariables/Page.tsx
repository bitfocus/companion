import React, { useCallback, useContext, useRef } from 'react'
import { CButton, CButtonGroup, CCol, CRow } from '@coreui/react'
import { useComputed } from '~/Resources/util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAdd, faClone, faCopy, faLayerGroup, faList, faTimes, faTrash } from '@fortawesome/free-solid-svg-icons'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { CreateExpressionVariableControlId, ParseControlId } from '@companion-app/shared/ControlId.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable'
import {
	ClientExpressionVariableData,
	ExpressionVariableCollection,
} from '@companion-app/shared/Model/ExpressionVariableModel.js'
import {
	ExpressionVariablesTableContextProvider,
	useExpressionVariablesTableContext,
} from './ExpressionVariablesTableContext'
import { useExpressionVariablesCollectionsApi } from './ExpressionVariablesCollectionsApi'
import CopyToClipboard from 'react-copy-to-clipboard'
import { trpc, useMutationExt } from '~/Resources/TRPC'

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

	const showPrimaryPanel = !selectedVariableId
	const showSecondaryPanel = !!selectedVariableId

	return (
		<CRow className="triggers-page split-panels">
			<GenericConfirmModal ref={confirmModalRef} />

			<CCol xs={12} xl={6} className={`primary-panel ${showPrimaryPanel ? '' : 'd-xl-block d-none'}`}>
				<h4>Expression variables</h4>
				<p style={{ marginBottom: '0.5rem' }}>Here you can create some variables from live computed expressions</p>

				<div className="mb-2">
					<CButtonGroup>
						<CButton color="warning" onClick={doAddNew} size="sm">
							<FontAwesomeIcon icon={faAdd} /> Add Expression Variable
						</CButton>
						<CreateCollectionButton />
					</CButtonGroup>
				</div>

				<PanelCollapseHelperProvider
					storageId="expression-variable-groups"
					knownPanelIds={expressionVariablesList.allCollectionIds}
					defaultCollapsed
				>
					<ExpressionVariablesTableContextProvider
						deleteModalRef={confirmModalRef}
						selectExpressionVariable={selectExpressionVariable}
					>
						<CollectionsNestingTable<ExpressionVariableCollection, ExpressionVariableDataWithId>
							// Heading={ExpressionVariablesListTableHeading}
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
			</CCol>

			<CCol xs={12} xl={6} className={`secondary-panel ${showSecondaryPanel ? '' : 'd-xl-block d-none'}`}>
				<div className="secondary-panel-simple">
					{!!selectedVariableId && <ExpressionVariableEditPanelHeading doCloseVariable={doCloseVariable} />}
					<Outlet />
				</div>
			</CCol>
		</CRow>
	)
})

export interface ExpressionVariableDataWithId extends Omit<ClientExpressionVariableData, 'collectionId'> {
	id: string
	collectionId: string | null
}

function ExpressionVariablesListNoContent() {
	return <NonIdealState icon={faList} text="There are currently no expression variables." />
}

function ExpressionVariableItemRow(item: ExpressionVariableDataWithId) {
	return <ExpressionVariableTableRow item={item} />
}

interface ExpressionVariableTableRowProps {
	item: ExpressionVariableDataWithId
}

const ExpressionVariableTableRow = observer(function ExpressionVariableTableRow2({
	item,
}: ExpressionVariableTableRowProps) {
	const { notifier } = useContext(RootAppStoreContext)

	const tableContext = useExpressionVariablesTableContext()

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

	const doEdit = useCallback(() => {
		tableContext.selectExpressionVariable(item.id)
	}, [tableContext, item.id])

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

	const fullname = item.variableName ? `$(computed:${item.variableName})` : null

	const onCopied = useCallback(() => {
		notifier.current?.show(`Copied`, 'Copied to clipboard', 5000)
	}, [notifier])

	return (
		<div onClick={doEdit} className="flex flex-row align-items-center gap-2 hand">
			<div className="flex flex-column grow">
				{fullname ? (
					<span className="variable-style">
						{fullname}
						<CopyToClipboard text={fullname} onCopy={onCopied}>
							<CButton size="sm" title="Copy variable name">
								<FontAwesomeIcon icon={faCopy} color="#d50215" />
							</CButton>
						</CopyToClipboard>
					</span>
				) : (
					<b>Unnamed</b>
				)}

				<span>{item.description ?? ''}</span>
			</div>

			<div className="action-buttons w-auto">
				<CButtonGroup>
					<CButton color="white" onClick={doClone} title="Clone">
						<FontAwesomeIcon icon={faClone} />
					</CButton>
					<CButton color="gray" onClick={doDelete} title="Delete">
						<FontAwesomeIcon icon={faTrash} />
					</CButton>
				</CButtonGroup>
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
		<CButton color="info" size="sm" onClick={doCreateCollection}>
			<FontAwesomeIcon icon={faLayerGroup} /> Create Collection
		</CButton>
	)
}

interface ExpressionVariableEditPanelHeadingProps {
	doCloseVariable: () => void
}

function ExpressionVariableEditPanelHeading({ doCloseVariable }: ExpressionVariableEditPanelHeadingProps) {
	return (
		<div className="secondary-panel-simple-header">
			<h4 className="panel-title">Edit Expression variable</h4>
			<div className="header-buttons">
				<div className="float_right ms-1" onClick={doCloseVariable} title="Close">
					<FontAwesomeIcon icon={faTimes} size="lg" />
				</div>
			</div>
		</div>
	)
}
