import { faAdd, faDollarSign, faLayerGroup, faList } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef, useState } from 'react'
import { isCustomVariableValid } from '@companion-app/shared/CustomVariable.js'
import type { CustomVariableDefinition } from '@companion-app/shared/Model/CustomVariableModel.js'
import { Button } from '~/Components/Button'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable'
import type {
	CollectionsNestingTableCollection,
	CollectionsNestingTableItem,
} from '~/Components/CollectionsNestingTable/Types'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { SearchBox } from '~/Components/SearchBox'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { PageHeader } from '~/Layout/PageHeader'
import { CloseButton, ContextHelpButton } from '~/Layout/PanelIcons'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { AddVariableModal, type AddVariableModalRef } from './AddVariableModal'
import { useCustomVariablesApi } from './CustomVariablesApi'
import { useCustomVariablesCollectionsApi } from './CustomVariablesCollectionsApi'
import { CustomVariableRow } from './CustomVariablesListRow'
import { CustomVariablesTableContextProvider } from './CustomVariablesTableContext'
import { useVariablesValuesForLabel } from './useVariablesValuesForLabel'
import { VariablesNav } from './VariablesNav.js'

export type CustomVariableDefinitionExt = Omit<CustomVariableDefinition, 'collectionId'> & CollectionsNestingTableItem
type CustomVariableCollectionExt = CollectionsNestingTableCollection

export const CustomVariablesListPage = observer(function CustomVariablesList() {
	const { variablesStore: customVariables } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: '/variables/custom' })

	const customVariableValues = useVariablesValuesForLabel('custom')

	const [filter, setFilter] = useState('')

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

	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/variables/custom/$name' })
	const selectedVariableId = routeMatch ? routeMatch.name : null

	const selectCustomVariable = useCallback(
		(name: string | null) => {
			if (name === null) {
				void navigate({ to: '/variables/custom' })
			} else {
				void navigate({ to: '/variables/custom/$name', params: { name } })
			}
		},
		[navigate]
	)

	const doCloseVariable = useCallback(() => {
		void navigate({ to: '/variables/custom' })
	}, [navigate])

	const addModalRef = useRef<AddVariableModalRef>(null)
	const doAddNew = useCallback(() => addModalRef.current?.show(), [])

	const createMutation = useMutationExt(trpc.customVariables.create.mutationOptions())
	const validateNewName = useCallback(
		(name: string) => {
			if (!isCustomVariableValid(name)) return 'Name must be alphanumeric and can contain underscores and dashes'
			if (customVariables.customVariables.has(name)) return 'A variable with this name already exists'
			return undefined
		},
		[customVariables]
	)
	const createVariable = useCallback(
		async (name: string) => {
			const res = await createMutation.mutateAsync({ name, defaultVal: '' })
			if (res) return res
			selectCustomVariable(name)
			return null
		},
		[createMutation, selectCustomVariable]
	)

	return (
		<div className="page-shell">
			<GenericConfirmModal ref={confirmModalRef} />
			<AddVariableModal
				ref={addModalRef}
				title="Add Custom Variable"
				nameHelp="The variable will be available as $(custom:name). This cannot be changed once set."
				validateName={validateNewName}
				create={createVariable}
			/>

			<PageHeader
				icon={faDollarSign}
				title="Custom Variables"
				helpAction="/user-guide/config/variables#custom-variables"
			/>

			<VariablesNav activeTab="custom" />

			<SplitPanels.Root
				showing={selectedVariableId ? 'secondary' : 'primary'}
				resize={{ storageKey: 'custom-variables' }}
			>
				<SplitPanels.Primary>
					<div className="flex flex-col h-full min-h-0 gap-2">
						{/* Top Header Card: Toolbar & Search */}
						<div className="bg-surface-muted/50 border border-border/70 p-3 rounded-lg flex flex-col gap-2.5 shrink-0">
							<div className="flex items-center justify-between gap-2 flex-wrap">
								<div className="flex flex-wrap items-center gap-2">
									<Button color="primary" onClick={doAddNew} size="sm">
										<FontAwesomeIcon icon={faAdd} className="me-1.5" /> Add Custom Variable
									</Button>
									<CreateCollectionButton />
								</div>
							</div>

							<SearchBox
								placeholder="Search custom variables..."
								filter={filter}
								setFilter={setFilter}
								className="w-full h-9"
							/>
						</div>

						{/* Custom Variables Table Container */}
						<div className="flex-1 min-h-0 scrollable-content list-card">
							<PanelCollapseHelperProvider
								storageId="custom-variable-groups"
								knownPanelIds={customVariables.allCustomVariableCollectionIds}
								defaultCollapsed
							>
								<CustomVariablesTableContextProvider
									customVariablesApi={customVariablesApi}
									customVariableValues={customVariableValues}
									selectCustomVariable={selectCustomVariable}
									selectedVariableId={selectedVariableId}
								>
									<CollectionsNestingTable<CustomVariableCollectionExt, CustomVariableDefinitionExt>
										NoContent={CustomVariableListNoContent}
										ItemRow={CustomVariableItemRow}
										itemName="custom variable"
										dragId="custom-variable"
										collectionsApi={collectionsApi}
										collections={customVariables.rootCustomVariableCollections()}
										items={allCustomVariables}
										selectedItemId={selectedVariableId}
									/>
								</CustomVariablesTableContextProvider>
							</PanelCollapseHelperProvider>
						</div>
					</div>
				</SplitPanels.Primary>

				<SplitPanels.Secondary>
					<div className="secondary-panel-simple">
						{!!selectedVariableId && <CustomVariableEditPanelHeading doCloseVariable={doCloseVariable} />}
						<Outlet />
					</div>
				</SplitPanels.Secondary>
			</SplitPanels.Root>
		</div>
	)
})

function CustomVariableListNoContent() {
	return <NonIdealState icon={faList} text="There are currently no custom variables." />
}

function CreateCollectionButton() {
	const createMutation = useMutationExt(trpc.customVariables.collections.add.mutationOptions())

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

interface CustomVariableEditPanelHeadingProps {
	doCloseVariable: () => void
}

function CustomVariableEditPanelHeading({ doCloseVariable }: CustomVariableEditPanelHeadingProps) {
	return (
		<div className="flex items-center justify-between gap-3 p-3 bg-surface-muted/40 border-b border-border/70 shrink-0">
			<div className="flex items-center gap-2">
				<span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-surface-muted text-muted text-xs">
					<FontAwesomeIcon icon={faDollarSign} />
				</span>
				<h3 className="text-sm font-bold text-body mb-0">Edit Custom Variable</h3>
			</div>
			<div className="flex items-center gap-1.5">
				<ContextHelpButton action="/user-guide/config/variables#custom-variables" />
				<CloseButton closeFn={doCloseVariable} />
			</div>
		</div>
	)
}
