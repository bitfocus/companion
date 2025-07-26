import React, { useCallback, useContext, useRef } from 'react'
import { CButton, CButtonGroup, CCol, CRow } from '@coreui/react'
import { useComputed } from '~/Resources/util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAdd, faClone, faCopy, faLayerGroup, faList, faTrash } from '@fortawesome/free-solid-svg-icons'
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
import { useCustomVariablesCollectionsApi } from './CustomVariablesCollectionsApi'
import CopyToClipboard from 'react-copy-to-clipboard'
import { trpc, useMutationExt } from '~/Resources/TRPC'

export const CustomVariablesPage = observer(function CustomVariablesPage() {
	const { customVariablesList } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: '/custom-variables' })

	const createMutation = useMutationExt(trpc.controls.customVariables.create.mutationOptions())

	const doAddNew = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			const addSimple = e.currentTarget.getAttribute('data-simple') === 'true'
			createMutation
				.mutateAsync({
					simple: addSimple,
				})
				.then(async (controlId) => {
					console.log('created custom variable', controlId)

					const parsedId = ParseControlId(controlId)
					if (parsedId?.type !== 'custom-variable') return

					await navigate({ to: `/custom-variables/${parsedId.variableId}` })
				})
				.catch((e) => {
					console.error('failed to create custom-variable', e)
				})
		},
		[createMutation, navigate]
	)

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
	const { notifier } = useContext(RootAppStoreContext)

	const tableContext = useCustomVariablesTableContext()

	const deleteMutation = useMutationExt(trpc.controls.customVariables.delete.mutationOptions())
	const cloneMutation = useMutationExt(trpc.controls.customVariables.clone.mutationOptions())

	const doDelete = useCallback(() => {
		tableContext.deleteModalRef.current?.show(
			'Delete custom variable',
			'Are you sure you wish to delete this custom variable?',
			'Delete',
			() => {
				deleteMutation.mutateAsync({ controlId: CreateCustomVariableControlId(item.id) }).catch((e) => {
					console.error('Failed to delete', e)
				})
			}
		)
	}, [deleteMutation, tableContext.deleteModalRef, item.id])

	const doEdit = useCallback(() => {
		tableContext.selectCustomVariable(item.id)
	}, [tableContext, item.id])

	const doClone = useCallback(() => {
		cloneMutation
			.mutateAsync({ controlId: CreateCustomVariableControlId(item.id) })
			.then((newControlId) => {
				console.log('cloned to control', newControlId)
			})
			.catch((e) => {
				console.error('Failed to clone', e)
			})
	}, [cloneMutation, item.id])

	const fullname = item.variableName ? `$(custom:${item.variableName})` : null

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
	const createMutation = useMutationExt(trpc.controls.customVariables.collections.add.mutationOptions())

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
