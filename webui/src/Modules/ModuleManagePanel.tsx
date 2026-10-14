import { faGithub } from '@fortawesome/free-brands-svg-icons'
import './modules-manage.css'
import { faBug, faFileLines, faInfoCircle, faStore } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link, useNavigate } from '@tanstack/react-router'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext } from 'react'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ModuleDisplayInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ModuleStoreListCacheEntry } from '@companion-app/shared/Model/ModulesStore.js'
import { capitalize } from '@companion-app/shared/Util.js'
import { StaticAlert } from '~/Components/Alert.js'
import { EditPanelTabLink } from '~/Components/EditPanelTabs.js'
import {
	EDIT_TAB_ACTIVE_CLASS,
	EDIT_TAB_BAR_CLASS,
	EDIT_TAB_CLASS,
	EDIT_TAB_INACTIVE_CLASS,
} from '~/Components/editPanelTabStyles.js'
import { Grid } from '~/Components/Grid'
import { CloseButton } from '~/Layout/PanelIcons.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { formatModuleProduct, getModuleProducts } from './ModuleCatalog.js'
import { ModuleDeprecationAlert, useModuleDeprecation } from './ModuleDeprecation.js'
import { ModuleDocsPanel } from './ModuleDocsPanel.js'
import { getModuleInstances } from './ModuleInstances.js'
import { ModuleVersionsTable } from './ModuleVersionsTable.js'
import { useModuleStoreInfo } from './useModuleStoreInfo.js'

interface ModuleManagePanelProps {
	moduleType: ModuleInstanceType
	moduleId: string
	tab: 'docs' | undefined
	docsVersion: string | undefined
}

export const ModuleManagePanel = observer(function ModuleManagePanel({
	moduleType,
	moduleId,
	tab,
	docsVersion,
}: ModuleManagePanelProps) {
	const { modules } = useContext(RootAppStoreContext)

	const moduleInfo = modules.getModuleInfo(moduleType, moduleId)?.display
	const moduleStoreInfo = modules.getStoreInfo(moduleType, moduleId)

	if (!moduleInfo && !moduleStoreInfo) {
		return (
			<Grid.Row className="edit-connection">
				<Grid.Col xs={12}>
					<p>Module not found</p>
				</Grid.Col>
			</Grid.Row>
		)
	}

	return (
		<ModuleManagePanelInner
			moduleType={moduleType}
			moduleId={moduleId}
			tab={tab}
			docsVersion={docsVersion}
			moduleInfo={moduleInfo}
			moduleStoreBaseInfo={moduleStoreInfo}
		/>
	)
})

interface ModuleManagePanelInnerProps extends ModuleManagePanelProps {
	moduleType: ModuleInstanceType
	moduleId: string
	moduleInfo: ModuleDisplayInfo | undefined
	moduleStoreBaseInfo: ModuleStoreListCacheEntry | undefined
}

const ModuleManagePanelInner = observer(function ModuleManagePanelInner({
	moduleType,
	moduleId,
	moduleInfo,
	moduleStoreBaseInfo,
	tab,
	docsVersion,
}: ModuleManagePanelInnerProps) {
	const moduleStoreInfo = useModuleStoreInfo(moduleType, moduleId)
	const navigate = useNavigate()
	const rootStore = useContext(RootAppStoreContext)
	const installedInfo = rootStore.modules.getModuleInfo(moduleType, moduleId)
	const isConnection = moduleType === ModuleInstanceType.Connection
	const usages = getModuleInstances(rootStore, moduleType, moduleId)
	const { manufacturer, products } = getModuleProducts(moduleInfo, moduleStoreBaseInfo)
	const version =
		installedInfo?.devVersion ??
		installedInfo?.stableVersion ??
		installedInfo?.betaVersion ??
		installedInfo?.builtinVersion
	const helpPath = version?.helpPath || moduleStoreBaseInfo?.helpUrl
	const docsInstalledVersion = docsVersion
		? [...(installedInfo?.installedVersions ?? []), installedInfo?.devVersion, installedInfo?.builtinVersion].find(
				(candidate) => candidate?.versionId === docsVersion
			)
		: version
	const docsHelpPath = docsVersion
		? (docsInstalledVersion?.helpPath ??
			moduleStoreInfo?.versions.find((candidate) => candidate.id === docsVersion)?.helpUrl ??
			(docsVersion === version?.versionId ? helpPath : undefined))
		: helpPath
	const showDocs = useCallback(
		(versionId: string) => {
			void navigate({
				to: '/modules/$moduleType/$moduleId/docs/$docsVersion',
				params: { moduleType, moduleId, docsVersion: versionId },
			})
		},
		[navigate, moduleType, moduleId]
	)
	const docsTabVersion = docsVersion ?? version?.versionId
	const issueUrl = moduleInfo?.bugUrl || moduleStoreBaseInfo?.githubUrl
	const badges = [
		...(installedInfo?.builtinVersion ? ['Built-in'] : []),
		...(installedInfo?.devVersion ? ['Development'] : []),
	]

	const deprecation = useModuleDeprecation(
		moduleType,
		moduleId,
		tab === 'docs' ? (docsVersion ?? version?.versionId ?? null) : null
	)

	const baseInfo = moduleInfo || moduleStoreBaseInfo
	const moduleName = baseInfo?.name ?? moduleId
	// A module named after its only product doesn't need it listed again
	const isNamedAfterProduct =
		products.length === 1 &&
		[products[0], formatModuleProduct(manufacturer, products[0])].some(
			(name) => name.toLocaleLowerCase() === moduleName.toLocaleLowerCase()
		)
	const extraProducts = isNamedAfterProduct ? [] : products

	const doCloseModule = useCallback(() => {
		void navigate({ to: '/modules' })
	}, [navigate])

	return (
		<>
			<div className="secondary-panel-simple-header panel-header-compact">
				<div className="flex items-center gap-2 min-w-0 pr-16">
					<span className="module-type-chip">{capitalize(moduleType)}</span>
					<h3 className="text-base font-bold truncate text-body mb-0" title={moduleId}>
						{moduleName}
					</h3>
					{badges.map((badge) => (
						<span key={badge} className="shrink-0 rounded-md bg-surface-muted px-2 py-1 text-2xs font-medium text-body">
							{badge}
						</span>
					))}
				</div>

				<CloseButton closeFn={doCloseModule} className="absolute top-2.5 right-3" />
			</div>

			<nav className={EDIT_TAB_BAR_CLASS} aria-label="Module views">
				<Link
					to="/modules/$moduleType/$moduleId"
					params={{ moduleType, moduleId }}
					aria-current={!tab ? 'page' : undefined}
					className={classNames(EDIT_TAB_CLASS, !tab ? EDIT_TAB_ACTIVE_CLASS : EDIT_TAB_INACTIVE_CLASS, 'no-underline')}
				>
					<FontAwesomeIcon icon={faInfoCircle} className="text-muted" />
					<span>Overview</span>
				</Link>

				<Link
					{...(docsTabVersion
						? {
								to: '/modules/$moduleType/$moduleId/docs/$docsVersion',
								params: { moduleType, moduleId, docsVersion: docsTabVersion },
							}
						: { to: '/modules/$moduleType/$moduleId/docs', params: { moduleType, moduleId } })}
					aria-current={tab === 'docs' ? 'page' : undefined}
					className={classNames(
						EDIT_TAB_CLASS,
						tab === 'docs' ? EDIT_TAB_ACTIVE_CLASS : EDIT_TAB_INACTIVE_CLASS,
						'no-underline'
					)}
				>
					<FontAwesomeIcon icon={faFileLines} className="text-muted" />
					<span>Docs</span>
				</Link>

				{moduleStoreBaseInfo?.githubUrl && (
					<EditPanelTabLink href={moduleStoreBaseInfo.githubUrl} icon={faGithub} label="GitHub" />
				)}
				{moduleStoreBaseInfo?.storeUrl && (
					<EditPanelTabLink href={moduleStoreBaseInfo.storeUrl} icon={faStore} label="Store" />
				)}
				{issueUrl && <EditPanelTabLink href={issueUrl} icon={faBug} label="Known issues" />}
			</nav>
			<div className="secondary-panel-simple-body p-4 space-y-4 overflow-y-auto flex-1">
				{tab === 'docs' ? (
					<>
						{docsTabVersion && (
							<div className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-muted">
								Documentation for <span className="font-semibold text-body">{docsTabVersion}</span>
							</div>
						)}
						<div className="max-w-readable space-y-4">
							{deprecation && <ModuleDeprecationAlert deprecation={deprecation} />}
							<ModuleDocsPanel helpPath={docsHelpPath} />
						</div>
					</>
				) : (
					<>
						{extraProducts.length > 0 && (
							<div className="max-w-readable space-y-4">
								<div className="flex flex-col gap-3 border-b border-border/70 pb-4">
									<h4 className="text-2xs font-medium uppercase tracking-wider text-muted mb-0">Supported products</h4>
									<ul className="flex flex-wrap gap-x-3 gap-y-2 list-none m-0 p-0 text-xs leading-relaxed text-muted">
										{extraProducts.map((product) => (
											<li key={product} className="rounded bg-surface-muted/50 px-2 py-1">
												{product}
											</li>
										))}
									</ul>
								</div>
							</div>
						)}
						{deprecation && <ModuleDeprecationAlert deprecation={deprecation} />}
						{moduleStoreInfo?.updateWarning && (
							<StaticAlert color="danger">{moduleStoreInfo.updateWarning}</StaticAlert>
						)}
						{usages.length > 0 && (
							<section className="space-y-2" aria-label="Module usage">
								<h4 className="text-xs font-medium text-muted mb-0">
									{`Used by ${usages.length} ${isConnection ? 'connection' : 'surface instance'}${usages.length === 1 ? '' : 's'}`}
								</h4>
								{usages.length > 0 && (
									<div className="list-card overflow-hidden">
										{usages.map((instance) => (
											<Link
												key={instance.id}
												to={isConnection ? '/connections/$connectionId' : '/surfaces/integrations/$instanceId'}
												params={isConnection ? { connectionId: instance.id } : { instanceId: instance.id }}
												className="list-row flex items-center justify-between gap-3 px-3 py-2 hover:bg-surface-muted/60"
											>
												<span className="text-sm font-medium text-body truncate">{instance.label}</span>
												<span className="text-2xs font-mono text-muted shrink-0">
													{instance.moduleVersionId ?? 'Default'}
													{!instance.enabled && <span className="ml-2 font-sans">Disabled</span>}
												</span>
											</Link>
										))}
									</div>
								)}
							</section>
						)}

						<div className="max-w-readable">
							<ModuleVersionsTable
								moduleType={moduleType}
								moduleId={moduleId}
								moduleStoreInfo={moduleStoreInfo}
								onShowDocs={showDocs}
							/>
						</div>
					</>
				)}
			</div>
		</>
	)
})
