import React, { useCallback, useContext, useRef } from 'react'
import { CButton, CButtonGroup, CCol, CRow } from '@coreui/react'
import { SocketContext, useComputed } from '~/util.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAdd, faClone, faLayerGroup, faList, faTrash } from '@fortawesome/free-solid-svg-icons'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { CreateCustomVariableControlId, ParseControlId } from '@companion-app/shared/ControlId.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable'
import { ClientCustomVariableData, CustomVariableCollection } from '@companion-app/shared/Model/CustomVariableModel.js'
import { CustomVariablesTableContextProvider, useCustomVariablesTableContext } from './CustomVariablesTableContext'
import { useCustomVariablesCollectionsApi } from '~/Variables/CustomVariablesCollectionsApi'

export const CustomVariablesPage = observer(function CustomVariablesPage() {
	const { socket, customVariablesList } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: '/custom-variables' })

	const doAddNew = useCallback(() => {
		socket
			.emitPromise('custom-variables2:create', [])
			.then(async (controlId) => {
				console.log('created custom variable', controlId)

				const parsedId = ParseControlId(controlId)
				if (parsedId?.type !== 'custom-variable') return

				await navigate({ to: `/custom-variables/${parsedId.variableId}` })
			})
			.catch((e) => {
				console.error('failed to create custom-variable', e)
			})
	}, [socket, navigate])

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const customVariablesGroupsApi = useCustomVariablesCollectionsApi(confirmModalRef)

	const allCustomVariables = useComputed(() => {
		const allCustomVariables: CustomVariableDataWithId[] = []

		for (const [variableId, variable] of customVariablesList.customVariables) {
			const parsedId = ParseControlId(variableId)
			if (!parsedId || parsedId.type !== 'custom-variable') continue
			allCustomVariables.push({ ...variable, id: parsedId.variableId, collectionId: variable.collectionId || null })
		}

		return allCustomVariables
	}, [customVariablesList.customVariables])

	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/custom-variables/$controlId' })
	const selectedVariableId = routeMatch ? routeMatch.controlId : null

	const selectCustomVariable = useCallback(
		(variableId: string | null) => {
			if (variableId === null) {
				void navigate({ to: '/custom-variables' })
			} else {
				void navigate({
					to: `/custom-variables/$controlId`,
					params: {
						controlId: variableId,
					},
				})
			}
		},
		[navigate]
	)

	return (
		<CRow className="triggers-page split-panels">
			<GenericConfirmModal ref={confirmModalRef} />

			<CCol xs={12} xl={6} className="primary-panel">
				<h4>Custom Variables</h4>
				<p style={{ marginBottom: '0.5rem' }}>
					Here you can create some variables as shortcuts for either static or dynamic values
				</p>

				<div className="mb-2">
					<CButtonGroup>
						<CButton color="primary" onClick={doAddNew} size="sm">
							<FontAwesomeIcon icon={faAdd} /> Add Custom Variable
						</CButton>
						<CButton color="info" size="sm" onClick={() => customVariablesGroupsApi.createCollection()}>
							<FontAwesomeIcon icon={faLayerGroup} /> Create Collection
						</CButton>
					</CButtonGroup>
				</div>

				<PanelCollapseHelperProvider
					storageId="custom-variable-groups"
					knownPanelIds={customVariablesList.allCollectionIds}
					defaultCollapsed
				>
					<CustomVariablesTableContextProvider
						deleteModalRef={confirmModalRef}
						selectCustomVariable={selectCustomVariable}
					>
						<CollectionsNestingTable<CustomVariableCollection, CustomVariableDataWithId>
							// Heading={CustomVariablesListTableHeading}
							NoContent={CustomVariablesListNoContent}
							ItemRow={CustomVariableItemRow}
							itemName="custom variable"
							dragId="custom-variable"
							collectionsApi={customVariablesGroupsApi}
							collections={customVariablesList.rootCollections()}
							items={allCustomVariables}
							selectedItemId={selectedVariableId}
						/>
					</CustomVariablesTableContextProvider>
				</PanelCollapseHelperProvider>
			</CCol>

			<CCol xs={12} xl={6} className="secondary-panel">
				<Outlet />
			</CCol>
		</CRow>
	)
})

export interface CustomVariableDataWithId extends Omit<ClientCustomVariableData, 'collectionId'> {
	id: string
	collectionId: string | null
}

function CustomVariablesListNoContent() {
	return <NonIdealState icon={faList} text="There are currently no custom variables." />
}

function CustomVariableItemRow(item: CustomVariableDataWithId) {
	return <CustomVariableTableRow item={item} />
}

interface CustomVariableTableRowProps {
	item: CustomVariableDataWithId
}

const CustomVariableTableRow = observer(function CustomVariableTableRow2({ item }: CustomVariableTableRowProps) {
	const socket = useContext(SocketContext)

	const tableContext = useCustomVariablesTableContext()

	const doDelete = useCallback(() => {
		tableContext.deleteModalRef.current?.show(
			'Delete custom variable',
			'Are you sure you wish to delete this custom variable?',
			'Delete',
			() => {
				socket.emitPromise('custom-variables2:delete', [CreateCustomVariableControlId(item.id)]).catch((e) => {
					console.error('Failed to delete', e)
				})
			}
		)
	}, [socket, tableContext.deleteModalRef, item.id])
	const doEdit = useCallback(() => {
		tableContext.selectCustomVariable(item.id)
	}, [tableContext, item.id])
	const doClone = useCallback(() => {
		socket
			.emitPromise('custom-variables2:clone', [CreateCustomVariableControlId(item.id)])
			.then((newControlId) => {
				console.log('cloned to control', newControlId)
			})
			.catch((e) => {
				console.error('Failed to clone', e)
			})
	}, [socket, item.id])

	return (
		<div onClick={doEdit} className="flex flex-row align-items-center gap-2 hand">
			<div className="flex flex-column grow">
				<b>{item.variableName ? `$(custom:${item.variableName})` : 'Unnamed'}</b>
				<br />
				{item.description ?? ''}
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
