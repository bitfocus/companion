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
import { Button } from '~/Components/Button'
import { InlineHelpCustom } from '~/Components/InlineHelp.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { SearchBox } from '~/Components/SearchBox.js'
import { TabArea } from '~/Components/TabArea.js'
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
	availableDeprecated: boolean
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
		availableDeprecated: false,
	})

	const [filterType, setFilterType] = useState<ModuleInstanceType | null>(null)
	const [filter, setFilter] = useState('')

	//  A module can support several devices: useAllModuleProducts returns the list of devices, so some modules are represented by several entries here.
	const allProducts = useAllModuleProducts(null, true, true).filter((p) => !filterType || filterType === p.moduleType)
	const typeProducts = allProducts.filter((p) => {
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
			(visibleModules.visibility.availableDeprecated || !p.storeInfo.deprecationReason) // only show deprecated ones when the flag is enabled
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
	const hiddenCount = modulesCount - new Set(typeProducts.map(moduleKey)).size

	return (
		<div className="flex-column-layout space-y-3">
			<div className="fixed-header space-y-3">
				{/* Top Header Card: Title Info & Filter Controls */}
				<div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-muted/50 border border-border/70 shadow-xs">
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2 mb-1">
							<h3 className="text-sm font-bold text-body mb-0">Module Catalog</h3>
						</div>
						<p className="text-xs text-muted mb-0 flex items-center gap-1.5 flex-wrap">
							<span>Browse over {modulesCount} integrations.</span>
							<span>•</span>
							<span className="inline-flex items-center gap-1">
								<LastUpdatedTimestamp timestamp={modules.storeUpdateInfo.lastUpdated} />
								<RefreshModulesList btnSize="sm" color="secondary" iconOnly className="inline-flex" />
							</span>
							<span>•</span>
							<a
								target="_blank"
								rel="noreferrer"
								href={makeAbsolutePath('/user-guide/config/modules')}
								className="underline hover:text-body"
							>
								Need help?
							</a>
						</p>
					</div>

					<div className="module-visibility-filters" role="group" aria-label="Filter modules by availability">
						<Button
							variant="ghost"
							className="module-visibility-filter"
							size="sm"
							aria-pressed={visibleModules.visibility.installed}
							onClick={() => visibleModules.toggleVisibility('installed')}
						>
							Installed
						</Button>
						<Button
							variant="ghost"
							className="module-visibility-filter"
							size="sm"
							aria-pressed={visibleModules.visibility.available}
							onClick={() => visibleModules.toggleVisibility('available')}
						>
							Available
						</Button>
						<Button
							variant="ghost"
							className="module-visibility-filter"
							size="sm"
							aria-pressed={visibleModules.visibility.availableDeprecated}
							onClick={() => visibleModules.toggleVisibility('availableDeprecated')}
						>
							Deprecated
						</Button>
					</div>
				</div>

				{/* Search Toolbar & Custom Module Import Row */}
				<div className="flex items-center gap-2 flex-wrap">
					<SearchBox
						filter={filter}
						setFilter={setFilter}
						placeholder="Search modules (e.g. ATEM, OBS, vMix, PTZOptics, Yamaha)..."
						className="flex-1 list-toolbar-search h-9"
					/>
					<ImportModules />
				</div>
			</div>

			<FilterTypeTabs filterType={filterType} setFilterType={setFilterType} />

			<div className="scrollable-content list-card">
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
			className={classNames('cursor-pointer transition-colors hover:bg-surface-muted/50', {
				'bg-primary/10 font-semibold text-primary border-l-4 border-l-primary': isSelected,
			})}
		>
			<td className="compact py-2 px-3 w-10">
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

interface FilterTypeTabsProps {
	filterType: ModuleInstanceType | null
	setFilterType: (type: ModuleInstanceType | null) => void
}

function FilterTypeTabs({ filterType, setFilterType }: FilterTypeTabsProps) {
	return (
		<TabArea.Root
			value={filterType}
			onValueChange={(v) => setFilterType(v as ModuleInstanceType | null)}
			className="remote-control-tabs"
		>
			<TabArea.List>
				<TabArea.Tab value={null} title="Show all module types">
					All Modules
				</TabArea.Tab>
				<TabArea.Tab value={ModuleInstanceType.Connection} title="Show only connection modules">
					Connection Modules
				</TabArea.Tab>
				<TabArea.Tab value={ModuleInstanceType.Surface} title="Show only surface modules">
					Surface Modules
				</TabArea.Tab>
			</TabArea.List>
		</TabArea.Root>
	)
}
