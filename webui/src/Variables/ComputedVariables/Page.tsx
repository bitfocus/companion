import React, { useCallback, useContext, useRef } from 'react'
import { CButton, CButtonGroup, CCol, CRow } from '@coreui/react'
import { useComputed } from '~/Resources/util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAdd, faClone, faCopy, faLayerGroup, faList, faTimes, faTrash } from '@fortawesome/free-solid-svg-icons'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { CreateComputedVariableControlId, ParseControlId } from '@companion-app/shared/ControlId.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable'
import {
	ClientComputedVariableData,
	ComputedVariableCollection,
} from '@companion-app/shared/Model/ComputedVariableModel.js'
import {
	ComputedVariablesTableContextProvider,
	useComputedVariablesTableContext,
} from './ComputedVariablesTableContext'
import { useComputedVariablesCollectionsApi } from './ComputedVariablesCollectionsApi'
import CopyToClipboard from 'react-copy-to-clipboard'
import { trpc, useMutationExt } from '~/Resources/TRPC'

export const ComputedVariablesPage = observer(function ComputedVariablesPage() {
	const { computedVariablesList } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: '/computed-variables' })

	const createMutation = useMutationExt(trpc.controls.computedVariables.create.mutationOptions())

	const doAddNew = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			const addSimple = e.currentTarget.getAttribute('data-simple') === 'true'
			createMutation
				.mutateAsync({
					simple: addSimple,
				})
				.then(async (controlId) => {
					console.log('created computed variable', controlId)

					const parsedId = ParseControlId(controlId)
					if (parsedId?.type !== 'computed-variable') return

					await navigate({ to: `/computed-variables/${parsedId.variableId}` })
				})
				.catch((e) => {
					console.error('failed to create computed-variable', e)
				})
		},
		[createMutation, navigate]
	)

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const computedVariablesGroupsApi = useComputedVariablesCollectionsApi(confirmModalRef)

	const allComputedVariables = useComputed(() => {
		const allComputedVariables: ComputedVariableDataWithId[] = []

		for (const [variableId, variable] of computedVariablesList.computedVariables) {
			const parsedId = ParseControlId(variableId)
			if (!parsedId || parsedId.type !== 'computed-variable') continue
			allComputedVariables.push({ ...variable, id: parsedId.variableId, collectionId: variable.collectionId || null })
		}

		return allComputedVariables
	}, [computedVariablesList.computedVariables])

	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/computed-variables/$controlId' })
	const selectedVariableId = routeMatch ? routeMatch.controlId : null

	const selectComputedVariable = useCallback(
		(variableId: string | null) => {
			if (variableId === null) {
				void navigate({ to: '/computed-variables' })
			} else {
				void navigate({
					to: `/computed-variables/$controlId`,
					params: {
						controlId: variableId,
					},
				})
			}
		},
		[navigate]
	)

	const doCloseVariable = useCallback(() => {
		void navigate({ to: '/computed-variables' })
	}, [navigate])

	const showPrimaryPanel = !selectedVariableId
	const showSecondaryPanel = !!selectedVariableId

	return (
		<CRow className="triggers-page split-panels">
			<GenericConfirmModal ref={confirmModalRef} />

			<CCol xs={12} xl={6} className={`primary-panel ${showPrimaryPanel ? '' : 'd-xl-block d-none'}`}>
				<h4>Computed Variables</h4>
				<p style={{ marginBottom: '0.5rem' }}>
					Here you can create some variables as shortcuts for either static or dynamic values
				</p>

				<div className="mb-2">
					<CButtonGroup>
						<CButton color="primary" onClick={doAddNew} size="sm" data-simple={true}>
							<FontAwesomeIcon icon={faAdd} /> Add Simple Variable
						</CButton>
						<CButton color="warning" onClick={doAddNew} size="sm" data-simple={false}>
							<FontAwesomeIcon icon={faAdd} /> Add Expression Variable
						</CButton>
						<CreateCollectionButton />
					</CButtonGroup>
				</div>

				<PanelCollapseHelperProvider
					storageId="computed-variable-groups"
					knownPanelIds={computedVariablesList.allCollectionIds}
					defaultCollapsed
				>
					<ComputedVariablesTableContextProvider
						deleteModalRef={confirmModalRef}
						selectComputedVariable={selectComputedVariable}
					>
						<CollectionsNestingTable<ComputedVariableCollection, ComputedVariableDataWithId>
							// Heading={ComputedVariablesListTableHeading}
							NoContent={ComputedVariablesListNoContent}
							ItemRow={ComputedVariableItemRow}
							itemName="computed variable"
							dragId="computed-variable"
							collectionsApi={computedVariablesGroupsApi}
							collections={computedVariablesList.rootCollections()}
							items={allComputedVariables}
							selectedItemId={selectedVariableId}
						/>
					</ComputedVariablesTableContextProvider>
				</PanelCollapseHelperProvider>
			</CCol>

			<CCol xs={12} xl={6} className={`secondary-panel ${showSecondaryPanel ? '' : 'd-xl-block d-none'}`}>
				<div className="secondary-panel-simple">
					{!!selectedVariableId && <ComputedVariableEditPanelHeading doCloseVariable={doCloseVariable} />}
					<Outlet />
				</div>
			</CCol>
		</CRow>
	)
})

export interface ComputedVariableDataWithId extends Omit<ClientComputedVariableData, 'collectionId'> {
	id: string
	collectionId: string | null
}

function ComputedVariablesListNoContent() {
	return <NonIdealState icon={faList} text="There are currently no computed variables." />
}

function ComputedVariableItemRow(item: ComputedVariableDataWithId) {
	return <ComputedVariableTableRow item={item} />
}

interface ComputedVariableTableRowProps {
	item: ComputedVariableDataWithId
}

const ComputedVariableTableRow = observer(function ComputedVariableTableRow2({ item }: ComputedVariableTableRowProps) {
	const { notifier } = useContext(RootAppStoreContext)

	const tableContext = useComputedVariablesTableContext()

	const deleteMutation = useMutationExt(trpc.controls.computedVariables.delete.mutationOptions())
	const cloneMutation = useMutationExt(trpc.controls.computedVariables.clone.mutationOptions())

	const doDelete = useCallback(() => {
		tableContext.deleteModalRef.current?.show(
			'Delete computed variable',
			'Are you sure you wish to delete this computed variable?',
			'Delete',
			() => {
				deleteMutation.mutateAsync({ controlId: CreateComputedVariableControlId(item.id) }).catch((e) => {
					console.error('Failed to delete', e)
				})
			}
		)
	}, [deleteMutation, tableContext.deleteModalRef, item.id])

	const doEdit = useCallback(() => {
		tableContext.selectComputedVariable(item.id)
	}, [tableContext, item.id])

	const doClone = useCallback(() => {
		cloneMutation
			.mutateAsync({ controlId: CreateComputedVariableControlId(item.id) })
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
	const createMutation = useMutationExt(trpc.controls.computedVariables.collections.add.mutationOptions())

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

interface ComputedVariableEditPanelHeadingProps {
	doCloseVariable: () => void
}

function ComputedVariableEditPanelHeading({ doCloseVariable }: ComputedVariableEditPanelHeadingProps) {
	return (
		<div className="secondary-panel-simple-header">
			<h4 className="panel-title">Edit Computed Variable</h4>
			<div className="header-buttons">
				<div className="float_right ms-1" onClick={doCloseVariable} title="Close">
					<FontAwesomeIcon icon={faTimes} size="lg" />
				</div>
			</div>
		</div>
	)
}
