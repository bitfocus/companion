import React, { FormEvent, useCallback, useContext, useRef, useState } from 'react'
import { CButton, CButtonGroup, CForm, CFormInput, CInputGroup } from '@coreui/react'
import { useComputed } from '~/util.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faArrowLeft,
	faCompressArrowsAlt,
	faExpandArrowsAlt,
	faLayerGroup,
	faSquareRootVariable,
	faTimes,
} from '@fortawesome/free-solid-svg-icons'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { isCustomVariableValid } from '@companion-app/shared/CustomVariable.js'
import { PanelCollapseHelperProvider, usePanelCollapseHelperContext } from '~/Helpers/CollapseHelper.js'
import { CustomVariableDefinition } from '@companion-app/shared/Model/CustomVariableModel.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { Link } from '@tanstack/react-router'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable'
import {
	CollectionsNestingTableCollection,
	CollectionsNestingTableItem,
} from '~/Components/CollectionsNestingTable/Types'
import { useCustomVariablesCollectionsApi } from './CustomVariablesCollectionsApi'
import { useCustomVariablesApi } from './CustomVariablesApi'
import { CustomVariablesTableContextProvider } from './CustomVariablesTableContext'
import { useCustomVariablesValues } from './useCustomVariableValues'
import { CustomVariableRow } from './CustomVariablesListRow'

export type CustomVariableDefinitionExt = Omit<CustomVariableDefinition, 'collectionId'> & CollectionsNestingTableItem
type CustomVariableCollectionExt = CollectionsNestingTableCollection

export const CustomVariablesListPage = observer(function CustomVariablesList() {
	const { variablesStore: customVariables } = useContext(RootAppStoreContext)

	const customVariableValues = useCustomVariablesValues()

	const allVariableNames = useComputed(
		() => [...Array.from(customVariables.customVariables.keys()), ...customVariables.allCustomVariableCollectionIds],
		[customVariables]
	)

	const [filter, setFilter] = useState('')
	const clearFilter = useCallback(() => setFilter(''), [])
	const updateFilter = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.currentTarget.value), [])

	let filterRegexp: RegExp | null = null
	if (filter) {
		try {
			filterRegexp = new RegExp(filter, 'i')
		} catch (e) {
			console.error('Failed to compile filter regexp:', e)
		}
	}

	const CustomVariableItemRow = (item: CustomVariableDefinitionExt) => {
		if (filterRegexp && !item.id.match(filterRegexp)) return null

		return <CustomVariableRow info={item} />
	}

	const allCustomVariables: CustomVariableDefinitionExt[] = useComputed(() => {
		const defs: CustomVariableDefinitionExt[] = []
		for (const [name, variable] of customVariables.customVariables.entries()) {
			defs.push({
				...variable,
				id: name,
				collectionId: variable.collectionId ?? null,
			})
		}

		return defs
	}, [])

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const collectionsApi = useCustomVariablesCollectionsApi(confirmModalRef)

	const customVariablesApi = useCustomVariablesApi(confirmModalRef)

	return (
		<div className="variables-panel">
			<GenericConfirmModal ref={confirmModalRef} />

			<PanelCollapseHelperProvider storageId="custom_variables" knownPanelIds={allVariableNames}>
				<div>
					<h4 style={{ marginBottom: '0.8rem' }}>Custom Variables</h4>
					<CButtonGroup size="sm">
						<CButton color="primary" as={Link} to="/variables">
							<FontAwesomeIcon icon={faArrowLeft} />
							&nbsp; Go back
						</CButton>
						<CButton color="secondary" disabled>
							Custom Variables
						</CButton>
						<CButton color="info" size="sm" onClick={() => collectionsApi.createCollection()}>
							<FontAwesomeIcon icon={faLayerGroup} /> Create Collection
						</CButton>
						{(customVariables.customVariables.size > 0 || customVariables.customVariableCollections.size > 0) && (
							<ExpandCollapseButtons />
						)}
					</CButtonGroup>
				</div>

				<CInputGroup className="variables-table-filter">
					<CFormInput
						type="text"
						placeholder="Filter ..."
						onChange={updateFilter}
						value={filter}
						style={{ fontSize: '1.2em' }}
					/>
					<CButton color="danger" onClick={clearFilter}>
						<FontAwesomeIcon icon={faTimes} />
					</CButton>
				</CInputGroup>

				<div className="variables-table-scroller ">
					<CustomVariablesTableContextProvider
						customVariablesApi={customVariablesApi}
						customVariableValues={customVariableValues}
					>
						<div className="variables-table">
							<CollectionsNestingTable<CustomVariableCollectionExt, CustomVariableDefinitionExt>
								// Heading={TriggerListTableHeading}
								NoContent={CustomVariableListNoContent}
								ItemRow={CustomVariableItemRow}
								itemName="custom variable"
								dragId="custom-variable"
								collectionsApi={collectionsApi}
								collections={customVariables.rootCustomVariableCollections()}
								items={allCustomVariables}
								selectedItemId={null}
							/>
						</div>
					</CustomVariablesTableContextProvider>
				</div>

				<h5 className="mt-2">Create custom variable</h5>
				<div className="mx-1 mb-1">
					<AddVariablePanel />
				</div>

				<br style={{ clear: 'both' }} />
			</PanelCollapseHelperProvider>
		</div>
	)
})

function CustomVariableListNoContent() {
	return <NonIdealState icon={faSquareRootVariable} text="No custom variables are defined" />
}

const ExpandCollapseButtons = observer(function ExpandCollapseButtons() {
	const { variablesStore: customVariables } = useContext(RootAppStoreContext)

	const rootCustomVariables = Array.from(customVariables.customVariables.keys()) // TODO - filter
	const rootPanels = [...customVariables.rootCustomVariableCollections().map((c) => c.id), ...rootCustomVariables]

	const panelCollapseHelper = usePanelCollapseHelperContext()

	return (
		<>
			{panelCollapseHelper.canExpandAll(null, rootPanels) && (
				<CButton
					color="secondary"
					onClick={() => panelCollapseHelper.setAllExpanded(null, rootPanels)}
					title="Expand all"
				>
					<FontAwesomeIcon icon={faExpandArrowsAlt} /> Expand All
				</CButton>
			)}
			{panelCollapseHelper.canCollapseAll(null, rootPanels) && (
				<CButton
					color="secondary"
					onClick={() => panelCollapseHelper.setAllCollapsed(null, rootPanels)}
					title="Collapse all"
				>
					<FontAwesomeIcon icon={faCompressArrowsAlt} /> Collapse All
				</CButton>
			)}
		</>
	)
})

function AddVariablePanel() {
	const { socket, notifier } = useContext(RootAppStoreContext)
	const panelCollapseHelper = usePanelCollapseHelperContext()

	const [newName, setNewName] = useState('')

	const doCreateNew = useCallback(
		(e: FormEvent) => {
			e?.preventDefault()

			if (isCustomVariableValid(newName)) {
				socket
					.emitPromise('custom-variables:create', [newName, ''])
					.then((res) => {
						console.log('done with', res)
						if (res) {
							notifier.current?.show(`Failed to create variable`, res, 5000)
						}

						// clear value
						setNewName('')

						// Make sure the panel is open and wont be forgotten on first render
						setTimeout(() => panelCollapseHelper.setPanelCollapsed(newName, false), 10)
					})
					.catch((e) => {
						console.error('Failed to create variable')
						notifier.current?.show(`Failed to create variable`, e?.toString?.() ?? e ?? 'Failed', 5000)
					})
			}
		},
		[socket, notifier, panelCollapseHelper, newName]
	)

	return (
		<CForm onSubmit={doCreateNew}>
			<CInputGroup>
				<CFormInput
					type="text"
					value={newName}
					onChange={(e) => setNewName(e.currentTarget.value)}
					placeholder="variableName"
				/>
				<CButton color="primary" onClick={doCreateNew} disabled={!isCustomVariableValid(newName)}>
					Add
				</CButton>
			</CInputGroup>
		</CForm>
	)
}
