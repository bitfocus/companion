import './modules-manage.css'
import {
	faEyeSlash,
	faGamepad,
	faPlug,
	faQuestionCircle,
	faWarning,
	type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useState } from 'react'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { StaticAlert } from '~/Components/Alert.js'
import { InlineHelpCustom } from '~/Components/InlineHelp.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { SearchBox } from '~/Components/SearchBox.js'
import { StatusFilterPill } from '~/Components/StatusFilterPill.js'
import { Table } from '~/Components/Table.js'
import { useTableVisibilityHelper } from '~/Components/TableVisibility.js'
import { filterProducts, useAllModuleProducts, type FuzzyProduct } from '~/Hooks/useFilteredProducts.js'
import { assertNever, makeAbsolutePath } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ImportModules } from './ImportCustomModule.js'
import { LastUpdatedTimestamp } from './LastUpdatedTimestamp.js'
import { RefreshModulesList } from './RefreshModulesList.js'

interface VisibleModulesState {
	installed: boolean
	available: boolean
}

interface ModulesListProps {
	doManageModule: (moduleInfo: ModuleTypeAndIdPair | null) => void
	selectedModuleInfo: ModuleTypeAndIdPair | null
}

export interface ModuleTypeAndIdPair {
	moduleType: ModuleInstanceType
	moduleId: string
}

export const ModulesList = observer(function ModulesList({ doManageModule, selectedModuleInfo }: ModulesListProps) {
	const { modules } = useContext(RootAppStoreContext)

	const visibleModules = useTableVisibilityHelper<VisibleModulesState>('modules_visible', {
		installed: true,
		available: false,
	})
	const [showDeprecated, setShowDeprecated] = useState(false)

	const [filterType, setFilterType] = useState<ModuleInstanceType | null>(null)
	const [filter, setFilter] = useState('')

	//  A module can support several devices: useAllModuleProducts returns the list of devices, so some modules are represented by several entries here.
	const allProducts = useAllModuleProducts(null, true, true)
	const filteredTypeProducts = allProducts.filter((p) => !filterType || filterType === p.moduleType)
	const typeProducts = filteredTypeProducts.filter((p) => {
		let isVisible = false
		if (p.installedInfo) {
			if (
				(p.installedInfo.installedVersions.length > 0 ||
					p.installedInfo.devVersion ||
					p.installedInfo.builtinVersion) &&
				visibleModules.visibility.installed
			)
				isVisible = true
		}
		if (
			p.storeInfo &&
			visibleModules.visibility.available &&
			(showDeprecated || !p.storeInfo.deprecationReason) // only show deprecated ones when explicitly enabled for this view
		)
			isVisible = true

		return isVisible
	})

	const includeStoreModules = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			visibleModules.toggleVisibility('available', true)
		},
		[visibleModules]
	)

	let components: React.JSX.Element[] = []
	try {
		const searchResults = filterProducts(typeProducts, filter, true)

		const candidatesObj: Record<string, React.JSX.Element> = {}
		for (const moduleInfo of searchResults) {
			candidatesObj[moduleInfo.moduleId] = (
				<ModulesListRow
					key={moduleInfo.moduleId}
					moduleInfo={moduleInfo}
					doManageModule={doManageModule}
					isSelected={
						!!selectedModuleInfo &&
						moduleInfo.moduleId === selectedModuleInfo.moduleId &&
						moduleInfo.moduleType === selectedModuleInfo.moduleType
					}
				/>
			)
		}

		if (!filter) {
			components = Object.entries(candidatesObj)
				.sort((a, b) => {
					const aName = a[0].toLocaleLowerCase()
					const bName = b[0].toLocaleLowerCase()
					if (aName < bName) return -1
					if (aName > bName) return 1
					return 0
				})
				.map((c) => c[1])
		} else {
			components = Object.entries(candidatesObj).map((c) => c[1])
		}
	} catch (e) {
		console.error('Failed to compile candidates list:', e)

		components = []
		components.push(
			<tr key="module-list-build-error">
				<td colSpan={4}>
					<StaticAlert color="warning" role="alert">
						Failed to build list of modules:
						<br />
						{e?.toString()}
					</StaticAlert>
				</td>
			</tr>
		)
	}

	const moduleKey = (p: FuzzyProduct) => `${p.moduleType}:${p.moduleId}`
	const modulesCount = new Set(allProducts.map(moduleKey)).size
	const hiddenCount = new Set(filteredTypeProducts.map(moduleKey)).size - new Set(typeProducts.map(moduleKey)).size
	const countModules = (products: FuzzyProduct[]) => new Set(products.map(moduleKey)).size
	const connectionCount = countModules(
		allProducts.filter((product) => product.moduleType === ModuleInstanceType.Connection)
	)
	const surfaceCount = countModules(allProducts.filter((product) => product.moduleType === ModuleInstanceType.Surface))
	const installedCount = countModules(
		allProducts.filter(
			(product) =>
				product.installedInfo &&
				(product.installedInfo.installedVersions.length > 0 ||
					!!product.installedInfo.devVersion ||
					!!product.installedInfo.builtinVersion)
		)
	)
	const availableCount = countModules(allProducts.filter((product) => !!product.storeInfo))
	const deprecatedCount = countModules(allProducts.filter((product) => !!product.storeInfo?.deprecationReason))

	return (
		<div className="flex-column-layout modules-list-layout space-y-3">
			<div className="fixed-header flex flex-col gap-2.5 w-full px-1 py-1">
				<div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full">
					<SearchBox
						filter={filter}
						setFilter={setFilter}
						placeholder="Filter modules..."
						className="mb-0 flex-1 min-w-0 h-9"
					/>
					<div className="shrink-0">
						<ImportModules />
					</div>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex flex-wrap items-center gap-1.5">
						<StatusFilterPill
							label="All"
							count={modulesCount}
							isActive={filterType === null}
							onClick={() => setFilterType(null)}
							title="Show all module types"
						/>
						<StatusFilterPill
							label="Connections"
							count={connectionCount}
							isActive={filterType === ModuleInstanceType.Connection}
							onClick={() => setFilterType(ModuleInstanceType.Connection)}
						/>
						<StatusFilterPill
							label="Surfaces"
							count={surfaceCount}
							isActive={filterType === ModuleInstanceType.Surface}
							onClick={() => setFilterType(ModuleInstanceType.Surface)}
						/>
						<span className="h-5 w-px bg-border mx-0.5" aria-hidden="true" />
						<StatusFilterPill
							label="Installed"
							count={installedCount}
							isActive={visibleModules.visibility.installed}
							onClick={() => visibleModules.toggleVisibility('installed')}
						/>
						<StatusFilterPill
							label="Available"
							count={availableCount}
							isActive={visibleModules.visibility.available}
							onClick={() => visibleModules.toggleVisibility('available')}
						/>
						<StatusFilterPill
							label="Deprecated"
							count={deprecatedCount}
							isActive={showDeprecated}
							onClick={() => setShowDeprecated((visible) => !visible)}
						/>
					</div>

					<div className="text-xs text-muted flex items-center gap-1.5 shrink-0">
						<LastUpdatedTimestamp timestamp={modules.storeUpdateInfo.lastUpdated} />
						<RefreshModulesList btnSize="sm" color="secondary" iconOnly className="inline-flex" />
						<span>•</span>
						<a
							target="_blank"
							rel="noreferrer"
							href={makeAbsolutePath('/user-guide/config/modules')}
							className="underline hover:text-body"
						>
							Help
						</a>
					</div>
				</div>
			</div>

			<div className="scrollable-content modules-list-results list-card">
				<Table className="table-tight mb-0">
					<tbody>
						{components}
						{hiddenCount > 0 && (
							<tr>
								<td colSpan={4} className="p-3 text-xs text-muted">
									<div className="flex items-center gap-2">
										<FontAwesomeIcon icon={faEyeSlash} className="text-amber-500" />
										<span>
											<strong>{hiddenCount} Modules hidden</strong> by active filter toggles.
										</span>
									</div>
								</td>
							</tr>
						)}

						{modules.count === 0 && !visibleModules.visibility.available && (
							<tr>
								<td colSpan={4}>
									<NonIdealState icon={faPlug}>
										You don't have any modules installed yet. <br />
										Try enabling "Available" to view the full module catalog.
									</NonIdealState>
								</td>
							</tr>
						)}

						{components.length === 0 && allProducts.length > 0 && !!filter && !visibleModules.visibility.available && (
							<tr>
								<td colSpan={4}>
									<NonIdealState icon={faPlug}>
										No installed modules match your search.
										<br />
										{!visibleModules.visibility.available && (
											<a href="#" onClick={includeStoreModules} className="underline text-primary">
												Click here to include available modules from the store
											</a>
										)}
									</NonIdealState>
								</td>
							</tr>
						)}
					</tbody>
				</Table>
			</div>
		</div>
	)
})

interface ModulesListRowProps {
	moduleInfo: FuzzyProduct
	doManageModule: (moduleInfo: ModuleTypeAndIdPair | null) => void
	isSelected: boolean
}

const ModulesListRow = observer(function ModulesListRow({
	moduleInfo,
	doManageModule,
	isSelected,
}: ModulesListRowProps) {
	const { helpViewer } = useContext(RootAppStoreContext)

	const doShowHelp = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			if (!moduleInfo.helpUrl) return
			const latestVersionName =
				moduleInfo.installedInfo?.stableVersion?.versionId ?? moduleInfo.installedInfo?.betaVersion?.versionId ?? ''
			helpViewer.current?.showFromUrl(moduleInfo.moduleType, moduleInfo.moduleId, latestVersionName, moduleInfo.helpUrl)
		},
		[helpViewer, moduleInfo]
	)

	const doEdit = () => {
		if (!moduleInfo) return
		doManageModule({ moduleId: moduleInfo.moduleId, moduleType: moduleInfo.moduleType })
	}

	let icon: IconDefinition | null = null
	let iconTitle: string | null = null
	switch (moduleInfo.moduleType) {
		case ModuleInstanceType.Connection:
			icon = faPlug
			iconTitle = 'Connection Module'
			break
		case ModuleInstanceType.Surface:
			icon = faGamepad
			iconTitle = 'Surface Module'
			break
		default:
			assertNever(moduleInfo.moduleType)
			break
	}

	return (
		<tr
			onClick={doEdit}
			className={classNames('list-row', isSelected ? 'list-row-selected' : 'hover:bg-surface-muted/50')}
		>
			<td className="compact py-2 ps-4 pe-3 w-10">
				{icon && (
					<span
						title={iconTitle ?? ''}
						className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-surface-muted text-muted text-xs"
					>
						<FontAwesomeIcon icon={icon} />
					</span>
				)}
			</td>
			<td className="py-2 px-3 font-medium text-body">
				<div className="flex items-center gap-2">
					{!!moduleInfo.storeInfo?.deprecationReason && (
						<InlineHelpCustom help="Deprecated" className="text-amber-500">
							<FontAwesomeIcon icon={faWarning} aria-label="Deprecated" />
						</InlineHelpCustom>
					)}
					<span>{moduleInfo.name}</span>
				</div>
			</td>
			<td className="compact py-2 px-3 text-end w-12">
				{moduleInfo.helpUrl && (
					<button type="button" onClick={doShowHelp} className="panel-icon-button" title="Show documentation">
						<FontAwesomeIcon icon={faQuestionCircle} className="text-xs" />
					</button>
				)}
			</td>
		</tr>
	)
})
