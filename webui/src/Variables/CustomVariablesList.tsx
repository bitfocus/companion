import { CButtonGroup, CForm, CFormInput, CInputGroup } from '@coreui/react'
import {
	faArrowLeft,
	faCompressArrowsAlt,
	faExpandArrowsAlt,
	faLayerGroup,
	faList,
	faTimes,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef, useState } from 'react'
import { isCustomVariableValid } from '@companion-app/shared/CustomVariable.js'
import type { CustomVariableDefinition } from '@companion-app/shared/Model/CustomVariableModel.js'
import { Button, LinkButton } from '~/Components/Button'
import {
	CollectionsNestingTable,
	UNGROUPED_PANEL_ID,
} from '~/Components/CollectionsNestingTable/CollectionsNestingTable'
import type {
	CollectionsNestingTableCollection,
	CollectionsNestingTableItem,
} from '~/Components/CollectionsNestingTable/Types'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { PanelCollapseHelperProvider, usePanelCollapseHelperContext } from '~/Helpers/CollapseHelper.js'
import { ContextHelpButton } from '~/Layout/PanelIcons'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useCustomVariablesApi } from './CustomVariablesApi'
import { useCustomVariablesCollectionsApi } from './CustomVariablesCollectionsApi'
import { CustomVariableRow } from './CustomVariablesListRow'
import { CustomVariablesTableContextProvider } from './CustomVariablesTableContext'
import { useVariablesValuesForLabel } from './useVariablesValuesForLabel'

export type CustomVariableDefinitionExt = Omit<CustomVariableDefinition, 'collectionId'> & CollectionsNestingTableItem
type CustomVariableCollectionExt = CollectionsNestingTableCollection

export const CustomVariablesListPage = observer(function CustomVariablesList() {
	const { variablesStore: customVariables } = useContext(RootAppStoreContext)

	const customVariableValues = useVariablesValuesForLabel('custom')

	const allVariableNames = useComputed(
		() => [
			...Array.from(customVariables.customVariables.keys()),
			...customVariables.allCustomVariableCollectionIds,
			UNGROUPED_PANEL_ID,
		],
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
					<h4 className="btn-inline">
						Custom Variables
						<ContextHelpButton action="/user-guide/config/variables#custom-variables" />
					</h4>
					<p className="mb-2">
						Here you can create some variables which you can define the values of, and update with actions
					</p>

					<CButtonGroup size="sm">
						<LinkButton color="primary" to="/variables">
							<FontAwesomeIcon icon={faArrowLeft} />
							&nbsp; Go back
						</LinkButton>
						<Button color="secondary" disabled>
							Custom Variables
						</Button>
						<CreateCollectionButton />
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
					<Button color="danger" onClick={clearFilter}>
						<FontAwesomeIcon icon={faTimes} />
					</Button>
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
								showCollapseButtons
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
	return <NonIdealState icon={faList} text="No custom variables are defined" />
}

const ExpandCollapseButtons = observer(function ExpandCollapseButtons() {
	const { variablesStore: customVariables } = useContext(RootAppStoreContext)

	const rootCustomVariables = Array.from(customVariables.customVariables.keys()) // TODO - filter
	const rootPanels = [
		...customVariables.rootCustomVariableCollections().map((c) => c.id),
		...rootCustomVariables,
		UNGROUPED_PANEL_ID,
	]

	const panelCollapseHelper = usePanelCollapseHelperContext()

	return (
		<>
			{panelCollapseHelper.canExpandAll(null, rootPanels) && (
				<Button
					color="secondary"
					onClick={() => panelCollapseHelper.setAllExpanded(null, rootPanels)}
					title="Expand all"
				>
					<FontAwesomeIcon icon={faExpandArrowsAlt} /> Expand All
				</Button>
			)}
			{panelCollapseHelper.canCollapseAll(null, rootPanels) && (
				<Button
					color="secondary"
					onClick={() => panelCollapseHelper.setAllCollapsed(null, rootPanels)}
					title="Collapse all"
				>
					<FontAwesomeIcon icon={faCompressArrowsAlt} /> Collapse All
				</Button>
			)}
		</>
	)
})

function AddVariablePanel() {
	const { notifier } = useContext(RootAppStoreContext)
	const panelCollapseHelper = usePanelCollapseHelperContext()

	const [newName, setNewName] = useState('')

	const createMutation = useMutationExt(trpc.customVariables.create.mutationOptions())

	const doCreateNew = useCallback(
		(e: React.FormEvent) => {
			e?.preventDefault()

			if (!isCustomVariableValid(newName)) return
			createMutation
				.mutateAsync({ name: newName, defaultVal: '' })
				.then((res) => {
					console.log('done with', res)
					if (res) {
						notifier.show(`Failed to create variable`, res, 5000)
					}

					// clear value
					setNewName('')

					// Make sure the panel is open and wont be forgotten on first render
					setTimeout(() => panelCollapseHelper.setPanelCollapsed(newName, false), 10)
				})
				.catch((e) => {
					console.error('Failed to create variable')
					notifier.show(`Failed to create variable`, e?.toString?.() ?? e ?? 'Failed', 5000)
				})
		},
		[createMutation, notifier, panelCollapseHelper, newName]
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
				<Button color="primary" onClick={doCreateNew} disabled={!isCustomVariableValid(newName)}>
					Add
				</Button>
			</CInputGroup>
		</CForm>
	)
}

function CreateCollectionButton() {
	const createMutation = useMutationExt(trpc.customVariables.collections.add.mutationOptions())

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
