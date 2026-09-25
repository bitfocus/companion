import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faGithub } from '@fortawesome/free-brands-svg-icons'
import '../Modules/modules-manage.css'
import './AddInstancePanel.css'
import {
	faArrowLeft,
	faCamera,
	faCog,
	faExternalLink,
	faLightbulb,
	faList,
	faNetworkWired,
	faPlug,
	faPlus,
	faTv,
	faVideo,
	faVolumeHigh,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link } from '@tanstack/react-router'
import classNames from 'classnames'
import { BookOpen } from 'lucide-react'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useEffect, useId, useMemo, useState } from 'react'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ClientModuleVersionInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button.js'
import { SimpleDropdownInputField } from '~/Components/DropdownInputFieldSimple.js'
import { Form } from '~/Components/Form.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { PillButton, PillButtonGroup, type PillTone } from '~/Components/PillButton.js'
import { SearchBox } from '~/Components/SearchBox.js'
import { useTableVisibilityHelper } from '~/Components/TableVisibility.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { Tooltip } from '~/Components/Tooltip.js'
import { WindowLinkOpen } from '~/Helpers/Window.js'
import { filterProducts, useAllModuleProducts, type FuzzyProduct } from '~/Hooks/useFilteredProducts.js'
import { CloseButton, ContextHelpButton, type ContextHelpButtonProps } from '~/Layout/PanelIcons.js'
import { LastUpdatedTimestamp } from '~/Modules/LastUpdatedTimestamp.js'
import { RefreshModulesList } from '~/Modules/RefreshModulesList.js'
import { makeAbsolutePath, PreventDefaultHandler } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { AddInstanceService } from './AddInstanceService.js'
import { ModuleVersionsRefresh } from './ModuleVersionsRefresh.js'
import { useModuleVersionSelectOptions } from './useModuleVersionSelectOptions.js'

type BroadcastCategory = 'video' | 'camera' | 'audio' | 'media' | 'lighting' | 'routing' | 'all'

interface ModuleCategoryDefinition {
	id: Exclude<BroadcastCategory, 'all'>
	/** Label for the category tab */
	label: string
	/** Shorter label for the badge shown on each module entry */
	badgeLabel: string
	icon: IconDefinition
	tone: PillTone
	/** Matched as substrings against the module name, product and id */
	keywords: readonly string[]
}

/** Rough classification of the module catalog, matched in order. */
const MODULE_CATEGORIES: readonly ModuleCategoryDefinition[] = [
	{
		id: 'video',
		tone: 'good',
		label: 'Video Switchers',
		badgeLabel: 'Video Switcher',
		icon: faVideo,
		keywords: ['atem', 'vmix', 'tricaster', 'switcher', 'ross', 'roland'],
	},
	{
		id: 'camera',
		tone: 'info',
		label: 'Cameras & PTZ',
		badgeLabel: 'PTZ & Camera',
		icon: faCamera,
		keywords: ['camera', 'ptz', 'visca', 'birddog', 'sony', 'panasonic', 'canon'],
	},
	{
		id: 'audio',
		tone: 'accent',
		label: 'Audio & DSP',
		badgeLabel: 'Audio & DSP',
		icon: faVolumeHigh,
		keywords: ['audio', 'mixer', 'yamaha', 'behringer', 'x32', 'wing', 'dante', 'soundcraft', 'q-sys', 'qsys', 'shure'],
	},
	{
		id: 'media',
		tone: 'media',
		label: 'Playout & GFX',
		badgeLabel: 'Playout & GFX',
		icon: faTv,
		keywords: [
			'propresenter',
			'obs',
			'resolume',
			'caspar',
			'vlc',
			'hyperdeck',
			'playout',
			'media',
			'mitti',
			'playback',
		],
	},
	{
		id: 'lighting',
		tone: 'warning',
		label: 'Lighting & DMX',
		badgeLabel: 'Lighting & DMX',
		icon: faLightbulb,
		keywords: ['dmx', 'light', 'artnet', 'chamsys', 'grandma', 'etc', 'onyx', 'avolites'],
	},
	{
		id: 'routing',
		tone: 'routing',
		label: 'Routing & Matrix',
		badgeLabel: 'Routing & Matrix',
		icon: faNetworkWired,
		keywords: ['videohub', 'router', 'routing', 'matrix', 'aja', 'kumo', 'magewell', 'ndi'],
	},
]

const CATEGORY_TABS: readonly { id: BroadcastCategory; label: string; icon: IconDefinition; tone: PillTone }[] = [
	{ id: 'all', label: 'All', icon: faList, tone: 'primary' },
	...MODULE_CATEGORIES.map((cat) => ({ id: cat.id, label: cat.label, icon: cat.icon, tone: cat.tone })),
]

function getModuleCategory(item: FuzzyProduct): {
	category: BroadcastCategory
	badgeLabel: string
} {
	const str = `${item.name} ${item.product || ''} ${item.moduleId}`.toLowerCase()

	const category = MODULE_CATEGORIES.find((cat) => cat.keywords.some((keyword) => str.includes(keyword)))

	return {
		category: category?.id ?? 'all',
		badgeLabel: category?.badgeLabel ?? 'Integration',
	}
}

interface AddInstancePanelProps {
	service: AddInstanceService

	title: string
	helpAction: ContextHelpButtonProps['action']
	isSubpanel?: boolean
	isModal?: boolean
}

export const AddInstancePanel = observer(function AddInstancePanel({
	service,
	title,
	helpAction,
	isSubpanel,
	isModal,
}: AddInstancePanelProps) {
	const { modules } = useContext(RootAppStoreContext)

	const [filter, setFilter] = useState('')
	const [selectedCategory, setSelectedCategory] = useState<BroadcastCategory>('all')

	const [selectedModule, setSelectedModule] = useState<FuzzyProduct | null>(null)
	const addInstance = useCallback((moduleInfo: FuzzyProduct) => {
		setSelectedModule(moduleInfo)
	}, [])

	const typeFilter = useTableVisibilityHelper(`${service.moduleType}-add-type-filter`, {
		available: true,
	})

	// The number of modules
	const storeModulesOfTypeCount = modules.countStoreModulesOfType(service.moduleType)

	// A module can support several devices
	const allProducts = useAllModuleProducts(service.moduleType)
	const typeProducts = useMemo(
		() =>
			allProducts.filter((p) => storeModulesOfTypeCount === 0 || !!p.installedInfo || typeFilter.visibility.available),
		[allProducts, storeModulesOfTypeCount, typeFilter.visibility.available]
	)

	// Classifying a product scans it against every category keyword, so do it once per product
	const productCategories = useMemo(() => {
		const categories = new Map<FuzzyProduct, ReturnType<typeof getModuleCategory>>()
		for (const p of typeProducts) {
			categories.set(p, getModuleCategory(p))
		}
		return categories
	}, [typeProducts])

	const totalModulesCount = useMemo(() => new Set(allProducts.map((p) => p.moduleId)).size, [allProducts])
	const installedModulesCount = useMemo(
		() => new Set(allProducts.filter((p) => !!p.installedInfo).map((p) => p.moduleId)).size,
		[allProducts]
	)

	// Calculate counts for categories
	const categoryCounts = useMemo(() => {
		const counts: Record<BroadcastCategory, number> = {
			video: 0,
			camera: 0,
			audio: 0,
			media: 0,
			lighting: 0,
			routing: 0,
			all: typeProducts.length,
		}

		for (const cat of productCategories.values()) {
			if (cat.category !== 'all') counts[cat.category]++
		}

		return counts
	}, [typeProducts, productCategories])

	// Filter products by selected category if not searching
	const filteredByCategory = useMemo(() => {
		if (filter) return typeProducts // If user is actively typing a search query, search everything!

		if (selectedCategory === 'all') return typeProducts

		return typeProducts.filter((p) => productCategories.get(p)?.category === selectedCategory)
	}, [typeProducts, productCategories, selectedCategory, filter])

	let candidates: React.JSX.Element[] = []
	try {
		const searchResults = filterProducts(filteredByCategory, filter, false)

		const candidatesObj: Record<string, React.JSX.Element> = {}
		for (const moduleInfo of searchResults) {
			candidatesObj[moduleInfo.name] = (
				<AddInstanceEntry key={moduleInfo.name} moduleInfo={moduleInfo} addInstance={addInstance} />
			)
		}

		if (!filter) {
			candidates = Object.entries(candidatesObj)
				.sort((a, b) => {
					const aName = a[0].toLocaleLowerCase()
					const bName = b[0].toLocaleLowerCase()
					if (aName < bName) return -1
					if (aName > bName) return 1
					return 0
				})
				.map((c) => c[1])
		} else {
			candidates = Object.entries(candidatesObj).map((c) => c[1])
		}
	} catch (e) {
		console.error('Failed to compile candidates list:', e)

		candidates = []
		candidates.push(
			<StaticAlert color="warning" role="alert" key="error">
				Failed to build list of modules:
				<br />
				{e?.toString()}
			</StaticAlert>
		)
	}

	const includeStoreModules = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			typeFilter.toggleVisibility('available', true)
		},
		[typeFilter]
	)

	return (
		<>
			{!isModal && (
				<div className="secondary-panel-simple-header">
					<h4 className="panel-title">{selectedModule ? `Configure ${selectedModule.product}` : title}</h4>
					<div className="header-buttons">
						<ContextHelpButton action={helpAction} />
						<CloseButton closeFn={service.closeAddInstance} visibilityClass={isSubpanel ? '' : 'xl:hidden'} />
					</div>
				</div>
			)}

			<div className="secondary-panel-simple-body">
				{selectedModule ? (
					<AddInstanceConfigureStep
						moduleInfo={selectedModule}
						service={service}
						onBack={() => setSelectedModule(null)}
					/>
				) : (
					<>
						<div className="sticky-heading clear-both mb-4 space-y-3">
							{/* Top Header Card: Title Info & Filter / Refresh Controls */}
							<div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-muted/50 border border-border/70 shadow-xs">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2 mb-1">
										<h3 className="text-sm font-bold text-body mb-0">Device Catalog</h3>
									</div>
									<p className="text-xs text-muted mb-0 flex items-center gap-1.5 flex-wrap">
										<span>Browse hundreds of hardware & software integrations.</span>
										<span>•</span>
										<span className="inline-flex items-center gap-1">
											<LastUpdatedTimestamp timestamp={modules.storeUpdateInfo.lastUpdated} />
											<RefreshModulesList
												btnSize="sm"
												variant="ghost"
												iconOnly
												className="inline-flex text-muted hover:text-body"
											/>
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
										<span>•</span>
										<Link to="/modules" className="underline hover:text-body">
											Modules page
										</Link>
									</p>
								</div>

								{storeModulesOfTypeCount > 0 && (
									<PillButtonGroup>
										<PillButton
											tone="primary"
											active={typeFilter.visibility.available}
											onClick={() => typeFilter.toggleVisibility('available', true)}
										>
											All Available ({totalModulesCount})
										</PillButton>
										<PillButton
											tone="primary"
											active={!typeFilter.visibility.available}
											onClick={() => typeFilter.toggleVisibility('available', false)}
										>
											Installed Only ({installedModulesCount})
										</PillButton>
									</PillButtonGroup>
								)}
							</div>

							{/* Search Box */}
							<SearchBox
								filter={filter}
								setFilter={setFilter}
								placeholder="Search devices (e.g. ATEM, OBS, vMix, PTZOptics, Yamaha)..."
								className="w-full h-9"
							/>

							{/* Broadcast Domain Category Tabs */}
							<div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
								{CATEGORY_TABS.map((tab) => (
									<PillButton
										key={tab.id}
										tone={tab.tone}
										active={selectedCategory === tab.id}
										onClick={() => setSelectedCategory(tab.id)}
									>
										<FontAwesomeIcon icon={tab.icon} className="text-2xs" />
										<span>
											{tab.label} ({categoryCounts[tab.id]})
										</span>
									</PillButton>
								))}
							</div>
						</div>

						<div id="connection_add_search_results" className="grid grid-cols-1 md:grid-cols-2 gap-3">
							{candidates}
						</div>

						{candidates.length === 0 && allProducts.length > 0 && (
							<NonIdealState icon={faPlug}>
								No modules match your search.
								<br />
								{!typeFilter.visibility.available && (
									<a href="#" onClick={includeStoreModules}>
										Click here to include modules from the store
									</a>
								)}
							</NonIdealState>
						)}

						{candidates.length === 0 && allProducts.length === 0 && (
							<NonIdealState icon={faPlug}>
								No modules are installed.
								<br />
								Make sure you have an active internet connection, or load a module bundle into the{' '}
								<Link to="/modules">Modules tab</Link>
							</NonIdealState>
						)}
					</>
				)}
			</div>
		</>
	)
})

interface AddInstanceEntryProps {
	moduleInfo: FuzzyProduct
	addInstance: (module: FuzzyProduct) => void
}

const AddInstanceEntry = observer(function AddInstanceEntry({ moduleInfo, addInstance }: AddInstanceEntryProps) {
	const { helpViewer, surfaceInstances } = useContext(RootAppStoreContext)

	const addInstanceClick = useCallback(() => addInstance(moduleInfo), [addInstance, moduleInfo])
	const showHelpForVersion =
		moduleInfo.installedInfo?.devVersion ??
		moduleInfo.installedInfo?.stableVersion ??
		moduleInfo.installedInfo?.betaVersion ??
		moduleInfo.installedInfo?.builtinVersion ??
		moduleInfo.installedInfo?.installedVersions?.[0] ??
		(moduleInfo.storeInfo
			? { helpPath: moduleInfo.storeInfo.helpUrl, versionId: '', allowMultipleInstances: true }
			: undefined)

	const showHelpClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			if (showHelpForVersion?.helpPath) {
				helpViewer.current?.showFromUrl(
					moduleInfo.moduleType,
					moduleInfo.moduleId,
					showHelpForVersion.versionId,
					showHelpForVersion.helpPath
				)
			}
		},
		[
			helpViewer,
			moduleInfo.moduleType,
			moduleInfo.moduleId,
			showHelpForVersion?.helpPath,
			showHelpForVersion?.versionId,
		]
	)

	const alreadyAddedCount =
		moduleInfo.moduleType === ModuleInstanceType.Surface
			? surfaceInstances.getAllOfModuleId(moduleInfo.moduleId).length
			: 0
	const isLimitReached = alreadyAddedCount > 0 && !(showHelpForVersion?.allowMultipleInstances ?? false)

	const isInstalled = !!moduleInfo.installedInfo
	const isLegacy = moduleInfo.installedInfo?.stableVersion?.isLegacy

	const categoryMeta = useMemo(() => getModuleCategory(moduleInfo), [moduleInfo])

	return (
		<div
			onClick={isLimitReached ? undefined : addInstanceClick}
			className={classNames(
				'group relative flex flex-col justify-between p-3.5 rounded-xl border border-border bg-surface hover:border-primary/60 hover:shadow-md transition-all',
				isLimitReached ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
			)}
		>
			<div>
				<div className="flex items-start justify-between gap-2 mb-1.5">
					<h4 className="text-sm font-bold text-body group-hover:text-primary transition-colors mb-0 leading-snug">
						{moduleInfo.product || moduleInfo.name}
					</h4>
					<div className="flex items-center gap-1 shrink-0">
						<span className="px-1.5 py-0.5 rounded text-3xs font-medium bg-surface-muted text-muted border border-border">
							{categoryMeta.badgeLabel}
						</span>
						{isInstalled ? (
							<span className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/25">
								Installed
							</span>
						) : (
							<span className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-sky-500/10 text-sky-600 border border-sky-500/25">
								Store
							</span>
						)}
						{isLegacy && (
							<span
								title="This module has not been updated for Companion 3.0"
								className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/25"
							>
								Legacy
							</span>
						)}
					</div>
				</div>

				<div className="flex items-center gap-1.5 text-xs text-muted mb-3">
					<span className="font-medium text-body/80 truncate">{moduleInfo.name}</span>
					<span>•</span>
					<span className="font-mono text-2xs truncate">{moduleInfo.moduleId}</span>
				</div>
			</div>

			<div className="flex items-center justify-between gap-2 pt-2.5 border-t border-border/50 mt-auto">
				{/* Actions / Links */}
				<div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
					<Link
						to={`/modules/$moduleType/$moduleId`}
						params={{ moduleType: moduleInfo.moduleType, moduleId: moduleInfo.moduleId }}
						className="text-muted hover:text-body text-xs p-1"
						title="Manage module versions"
					>
						<FontAwesomeIcon icon={faCog} />
					</Link>
					{!!moduleInfo.storeInfo && (
						<WindowLinkOpen
							className="text-muted hover:text-body text-xs p-1"
							title="Open Store Page"
							href={moduleInfo.storeInfo.storeUrl}
						>
							<FontAwesomeIcon icon={faExternalLink} />
						</WindowLinkOpen>
					)}
					{!!moduleInfo.storeInfo?.githubUrl && (
						<WindowLinkOpen
							className="text-muted hover:text-body text-xs p-1"
							title="Open GitHub Page"
							href={moduleInfo.storeInfo.githubUrl}
						>
							<FontAwesomeIcon icon={faGithub} />
						</WindowLinkOpen>
					)}
					{showHelpForVersion?.helpPath && (
						<button
							type="button"
							onClick={showHelpClick}
							className="panel-icon-button panel-icon-button-sm"
							title="View documentation"
						>
							<BookOpen className="w-3.5 h-3.5" />
						</button>
					)}
				</div>

				{/* Add Button */}
				{isLimitReached ? (
					<Tooltip.Root>
						<Tooltip.Trigger render={<span />}>
							<Button color="secondary" size="sm" disabled>
								Limit Reached
							</Button>
						</Tooltip.Trigger>
						<Tooltip.Popup arrow>This module is limited to one instance</Tooltip.Popup>
					</Tooltip.Root>
				) : (
					<Button
						color="primary"
						size="sm"
						onClick={(e) => {
							e.stopPropagation()
							addInstanceClick()
						}}
						className="font-semibold shadow-xs"
					>
						<FontAwesomeIcon icon={faPlus} className="me-1" /> Add
					</Button>
				)}
			</div>
		</div>
	)
})

const AddInstanceConfigureStep = observer(function AddInstanceConfigureStep({
	moduleInfo,
	service,
	onBack,
}: {
	moduleInfo: FuzzyProduct
	service: AddInstanceService
	onBack: () => void
}) {
	const { helpViewer, notifier, modules } = useContext(RootAppStoreContext)
	const [instanceLabel, setInstanceLabel] = useState<string>('')
	const [selectedVersion, setSelectedVersion] = useState<string | null>(null)

	// Set initial label
	useEffect(() => {
		setInstanceLabel(service.findNextLabel(moduleInfo))
	}, [service, moduleInfo])

	const isModuleOnStore = !!modules.getStoreInfo(moduleInfo.moduleType, moduleInfo.moduleId)

	const {
		choices: versionChoices,
		loaded: choicesLoaded,
		hasIncompatibleNewerVersion,
	} = useModuleVersionSelectOptions(service.moduleType, moduleInfo.moduleId, moduleInfo.installedInfo, true)

	let defaultVersionId = moduleInfo.installedInfo?.stableVersion?.versionId
	if (moduleInfo.installedInfo?.devVersion) {
		defaultVersionId = 'dev'
	} else if (!defaultVersionId && moduleInfo.installedInfo?.builtinVersion) {
		defaultVersionId = 'builtin'
	}

	useEffect(() => {
		if (!versionChoices || versionChoices.length === 0) return

		setSelectedVersion((value) => {
			if (versionChoices.find((v) => v.id === value)) return value
			if (defaultVersionId) return defaultVersionId
			return String(versionChoices[0].id)
		})
	}, [versionChoices, defaultVersionId])

	let selectedVersionInfo: ClientModuleVersionInfo | undefined
	if (selectedVersion === 'dev') {
		selectedVersionInfo = moduleInfo.installedInfo?.devVersion ?? undefined
	} else if (selectedVersion === 'builtin') {
		selectedVersionInfo = moduleInfo.installedInfo?.builtinVersion ?? undefined
	} else {
		selectedVersionInfo = moduleInfo.installedInfo?.installedVersions.find((v) => v.versionId === selectedVersion)
	}
	const selectedVersionIsLegacy = selectedVersionInfo?.isLegacy ?? false

	const showHelpClick = useCallback(() => {
		if (!selectedVersionInfo) return
		helpViewer.current?.showFromUrl(
			moduleInfo.moduleType,
			moduleInfo.moduleId,
			selectedVersionInfo.versionId,
			selectedVersionInfo.helpPath
		)
	}, [helpViewer, moduleInfo, selectedVersionInfo])

	const doAction = useCallback(() => {
		if (!instanceLabel || !selectedVersion) return

		service
			.performAddInstance(moduleInfo, instanceLabel, selectedVersion)
			.then((id) => {
				console.log('NEW INSTANCE', id)
				setTimeout(() => {
					service.openConfigureInstance(id)
				}, 1000)
			})
			.catch((e) => {
				notifier.show(`Failed to create instance`, `Failed: ${e}`)
				console.error('Failed to create instance:', e)
			})
	}, [service, moduleInfo, instanceLabel, selectedVersion, notifier])

	const labelFieldId = useId()
	const versionFieldId = useId()

	return (
		<div className="space-y-4 max-w-2xl mx-auto py-2">
			{/* Hero Header Card */}
			<div className="rounded-md border border-border/70 bg-surface-muted/30 p-4">
				<div className="flex items-center justify-between gap-3">
					<div>
						<div className="flex items-center gap-2 mb-1">
							<span className="module-type-chip">
								New {service.moduleType === ModuleInstanceType.Connection ? 'Connection' : 'Surface'}
							</span>
							<span className="text-xs text-muted font-medium font-mono">{moduleInfo.moduleId}</span>
						</div>
						<h3 className="text-base font-bold text-body mb-0">{moduleInfo.product || moduleInfo.name}</h3>
					</div>

					<Button color="secondary" size="sm" onClick={onBack}>
						<FontAwesomeIcon icon={faArrowLeft} className="me-1" /> Back to Catalog
					</Button>
				</div>
			</div>

			{/* Configuration Card */}
			<div className="rounded-md border border-border/70 bg-surface p-4 space-y-4">
				<Form className="space-y-4" onSubmit={PreventDefaultHandler}>
					{/* Label Field */}
					<div>
						<label htmlFor={labelFieldId} className="block text-xs font-semibold text-body mb-1">
							Connection Label
						</label>
						<TextInputField id={labelFieldId} value={instanceLabel} setValue={setInstanceLabel} immediateValue />
						<p className="text-2xs text-muted mt-1 mb-0">
							A unique name used to reference this connection across actions, feedbacks, and triggers.
						</p>
					</div>

					{/* Version Field */}
					<div>
						<div className="flex items-center justify-between mb-1">
							<label htmlFor={versionFieldId} className="text-xs font-semibold text-body mb-0">
								Module Version
							</label>
							<div className="flex items-center gap-2">
								{selectedVersionInfo && (
									<button
										type="button"
										className="text-muted hover:text-primary text-xs cursor-pointer bg-transparent border-0 flex items-center gap-1 transition-colors"
										onClick={showHelpClick}
										title="View module documentation"
									>
										<BookOpen className="w-3 h-3" />
										<span>Docs</span>
									</button>
								)}
								{isModuleOnStore && (
									<ModuleVersionsRefresh moduleType={moduleInfo.moduleType} moduleId={moduleInfo.moduleId} />
								)}
							</div>
						</div>

						<SimpleDropdownInputField
							id={versionFieldId}
							value={selectedVersion as string}
							setValue={(value) => setSelectedVersion(value as string)}
							noOptionsMessage={choicesLoaded ? 'No compatible versions found' : 'Loading...'}
							choices={versionChoices}
						/>
						<p className="text-2xs text-muted mt-1 mb-0">
							Additional versions can be installed anytime via the Modules Manager.
						</p>
					</div>

					{hasIncompatibleNewerVersion && (
						<StaticAlert color="warning" className="mt-2 mb-0">
							There is a newer version of this module on the store, but it requires a newer version of Companion.
						</StaticAlert>
					)}
				</Form>

				{selectedVersionIsLegacy && (
					<StaticAlert color="warning">
						<p className="font-semibold mb-1">Legacy Module Warning</p>
						<p className="text-xs mb-0">
							This module version has not been verified for Companion 3.0. If you encounter issues, please report them
							to{' '}
							{moduleInfo.bugUrl ? (
								<a target="_blank" rel="noreferrer" href={moduleInfo.bugUrl} className="underline">
									GitHub
								</a>
							) : (
								'the module developer'
							)}
							.
						</p>
					</StaticAlert>
				)}
			</div>

			{/* Sticky Action Footer */}
			<div className="flex items-center justify-between gap-3 pt-2">
				<Button color="secondary" onClick={onBack}>
					Cancel
				</Button>
				<Button
					color="primary"
					onClick={doAction}
					disabled={!instanceLabel || !selectedVersion || !versionChoices.length}
					className="font-semibold px-4 shadow-sm"
				>
					<FontAwesomeIcon icon={faPlus} className="me-1.5" /> Create Connection
				</Button>
			</div>
		</div>
	)
})
