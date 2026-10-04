import '../Modules/modules-manage.css'
import './AddInstancePanel.css'
import { faArrowLeft, faFileLines, faGamepad, faPlug, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link } from '@tanstack/react-router'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useEffect, useId, useMemo, useState } from 'react'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ClientModuleVersionInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button, LinkButton } from '~/Components/Button.js'
import { SimpleDropdownInputField } from '~/Components/DropdownInputFieldSimple.js'
import { Form } from '~/Components/Form.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { SearchBox } from '~/Components/SearchBox.js'
import { StatusFilterPill } from '~/Components/StatusFilterPill.js'
import { useTableVisibilityHelper } from '~/Components/TableVisibility.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { filterProducts, useAllModuleProducts, type FuzzyProduct } from '~/Hooks/useFilteredProducts.js'
import { CloseButton, ContextHelpButton, type ContextHelpButtonProps } from '~/Layout/PanelIcons.js'
import { LastUpdatedTimestamp } from '~/Modules/LastUpdatedTimestamp.js'
import { getModuleProductName, groupModuleCatalog } from '~/Modules/ModuleCatalog.js'
import { RefreshModulesList } from '~/Modules/RefreshModulesList.js'
import { useModuleStoreInfo } from '~/Modules/useModuleStoreInfo.js'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { isSurfaceInstanceLimitReached } from './AddInstanceLimit.js'
import type { AddInstanceService } from './AddInstanceService.js'
import { ModuleVersionsRefresh } from './ModuleVersionsRefresh.js'
import { useModuleVersionSelectOptions } from './useModuleVersionSelectOptions.js'

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

	const totalModulesCount = useMemo(() => new Set(allProducts.map((p) => p.moduleId)).size, [allProducts])
	const installedModulesCount = useMemo(
		() => new Set(allProducts.filter((p) => !!p.installedInfo).map((p) => p.moduleId)).size,
		[allProducts]
	)

	let candidates: React.JSX.Element[] = []
	try {
		const searchResults = filterProducts(typeProducts, filter, false)
		for (const [key, group] of groupModuleCatalog(searchResults, !!filter.trim())) {
			candidates.push(
				<section key={key} aria-label={group.name}>
					<div className="flex items-center gap-2 bg-surface-muted/60 px-3 py-2 text-xs">
						<h4 className="font-semibold text-body text-xs mb-0">{group.name}</h4>
						<span className="text-muted">{group.modules.length}</span>
					</div>
					{group.modules.map((moduleInfo) => (
						<AddInstanceEntry
							key={`${moduleInfo.moduleType}:${moduleInfo.moduleId}`}
							moduleInfo={moduleInfo}
							addInstance={addInstance}
						/>
					))}
				</section>
			)
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
					<div className={classNames('w-full', !isModal && 'max-w-3xl mx-auto')}>
						<div className="mb-3 space-y-3 px-1 pt-1">
							<SearchBox filter={filter} setFilter={setFilter} placeholder="Filter modules..." className="w-full h-9" />
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div className="flex flex-wrap items-center gap-1.5">
									<StatusFilterPill
										label="All"
										count={totalModulesCount}
										isActive={typeFilter.visibility.available}
										onClick={() => typeFilter.toggleVisibility('available', true)}
									/>
									<StatusFilterPill
										label="Installed"
										count={installedModulesCount}
										isActive={!typeFilter.visibility.available}
										onClick={() => typeFilter.toggleVisibility('available', false)}
									/>
								</div>
								<div className="flex items-center gap-1.5 text-xs text-muted">
									<LastUpdatedTimestamp timestamp={modules.storeUpdateInfo.lastUpdated} />
									<RefreshModulesList btnSize="sm" color="secondary" iconOnly className="inline-flex h-7" />
									<LinkButton to="/modules" color="secondary" size="sm" className="inline-flex h-7 items-center">
										Modules Manager
									</LinkButton>
								</div>
							</div>
						</div>
						<div id="connection_add_search_results" className="list-card overflow-hidden">
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
					</div>
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
	const { surfaceInstances } = useContext(RootAppStoreContext)
	const installedInfo = moduleInfo.installedInfo
	const version =
		installedInfo?.devVersion ??
		installedInfo?.stableVersion ??
		installedInfo?.betaVersion ??
		installedInfo?.builtinVersion ??
		installedInfo?.installedVersions[0]
	const existingSurfaceCount =
		moduleInfo.moduleType === ModuleInstanceType.Surface
			? surfaceInstances.getAllOfModuleId(moduleInfo.moduleId).length
			: 0
	// Only subscribe to store versions when they can affect the limit
	const storeInfo = useModuleStoreInfo(
		moduleInfo.moduleType,
		existingSurfaceCount > 0 ? moduleInfo.moduleId : undefined
	)
	const isLimitReached = isSurfaceInstanceLimitReached(installedInfo, storeInfo, existingSurfaceCount)
	const installationLabel = installedInfo?.devVersion
		? 'Development'
		: installedInfo?.installedVersions.length
			? 'Installed'
			: installedInfo?.builtinVersion
				? 'Built-in'
				: 'Available'
	const versionLabel =
		installedInfo && installedInfo.installedVersions.length > 1 && !installedInfo.devVersion
			? `${installedInfo.installedVersions.length} versions`
			: version && version.versionId !== 'dev' && version.versionId !== 'builtin'
				? `v${version.versionId}`
				: undefined
	const products = [...new Set([...(installedInfo?.display.products ?? []), ...(moduleInfo.storeInfo?.products ?? [])])]
	return (
		<button
			type="button"
			disabled={isLimitReached}
			onClick={() => addInstance(moduleInfo)}
			title={isLimitReached ? 'This module is limited to one instance' : products.join(', ')}
			className={classNames(
				'add-module-row list-row flex w-full items-center gap-2 border-0 border-b border-border bg-transparent py-2 text-start hover:bg-surface-muted/50 disabled:opacity-60 disabled:cursor-not-allowed'
			)}
		>
			<span className="inline-flex shrink-0 items-center justify-center w-7 h-7 rounded-md bg-surface-muted text-muted text-xs">
				<FontAwesomeIcon icon={moduleInfo.moduleType === ModuleInstanceType.Connection ? faPlug : faGamepad} />
			</span>
			<span className="min-w-0 flex-1 break-words text-sm font-semibold text-body-strong">
				{getModuleProductName(moduleInfo)}
			</span>
			<span className="add-module-status flex min-w-0 items-center justify-end gap-2">
				{versionLabel && (
					<span className="min-w-0 truncate text-2xs font-mono text-muted/70" title={versionLabel}>
						{versionLabel}
					</span>
				)}
				<span
					className={classNames(
						'shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-medium',
						installationLabel === 'Installed'
							? 'bg-emerald-500/10 text-emerald-600'
							: installationLabel === 'Development'
								? 'bg-amber-500/10 text-amber-500'
								: 'bg-surface-muted text-muted'
					)}
				>
					{isLimitReached ? 'Limit reached' : installationLabel}
				</span>
			</span>
			<FontAwesomeIcon icon={faPlus} className="shrink-0 text-xs text-action-text" aria-hidden="true" />
		</button>
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
					<h3 className="text-base font-bold text-body mb-0">{moduleInfo.product || moduleInfo.name}</h3>

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
										className="text-action-text hover:text-primary text-xs cursor-pointer bg-transparent border-0 flex items-center gap-1 transition-colors"
										onClick={showHelpClick}
										title="View module documentation"
									>
										<FontAwesomeIcon icon={faFileLines} className="text-xs" />
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
			<div className="flex items-center justify-end gap-3 pt-2">
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
