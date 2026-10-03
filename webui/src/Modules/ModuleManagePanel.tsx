import { faGithub } from '@fortawesome/free-brands-svg-icons'
import './modules-manage.css'
import { faBug, faFileLines, faStore } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext } from 'react'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ModuleDisplayInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ModuleStoreListCacheEntry } from '@companion-app/shared/Model/ModulesStore.js'
import { capitalize } from '@companion-app/shared/Util.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Grid } from '~/Components/Grid'
import { CloseButton } from '~/Layout/PanelIcons.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ModuleVersionsTable } from './ModuleVersionsTable.js'
import { useModuleStoreInfo } from './useModuleStoreInfo.js'

interface ModuleManagePanelProps {
	moduleType: ModuleInstanceType
	moduleId: string
}

export const ModuleManagePanel = observer(function ModuleManagePanel({ moduleType, moduleId }: ModuleManagePanelProps) {
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
			moduleInfo={moduleInfo}
			moduleStoreBaseInfo={moduleStoreInfo}
		/>
	)
})

interface ModuleManagePanelInnerProps {
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
}: ModuleManagePanelInnerProps) {
	const moduleStoreInfo = useModuleStoreInfo(moduleType, moduleId)
	const navigate = useNavigate()
	const { modules, connections, surfaceInstances, helpViewer } = useContext(RootAppStoreContext)
	const installedInfo = modules.getModuleInfo(moduleType, moduleId)
	const isConnection = moduleType === ModuleInstanceType.Connection
	const usages = (
		isConnection ? Array.from(connections.connections.values()) : Array.from(surfaceInstances.instances.values())
	)
		.filter((instance) => instance.moduleType === moduleType && instance.moduleId === moduleId)
		.sort((a, b) => a.label.localeCompare(b.label))
	const products = [...new Set([...(moduleInfo?.products ?? []), ...(moduleStoreBaseInfo?.products ?? [])])]
	const version =
		installedInfo?.devVersion ??
		installedInfo?.stableVersion ??
		installedInfo?.betaVersion ??
		installedInfo?.builtinVersion
	const helpPath = version?.helpPath || moduleStoreBaseInfo?.helpUrl
	const issueUrl = moduleInfo?.bugUrl || moduleStoreBaseInfo?.githubUrl
	const badges = [
		...(installedInfo?.builtinVersion ? ['Built-in'] : []),
		...(installedInfo?.devVersion ? ['Development'] : []),
	]
	const baseInfo = moduleInfo || moduleStoreBaseInfo
	const moduleName = baseInfo?.name ?? moduleId
	const normalizeName = (value: string) => value.trim().toLocaleLowerCase()
	const manufacturer = moduleName.includes(':') ? moduleName.slice(0, moduleName.indexOf(':')).trim() : null
	const productName = (value: string) => {
		const colon = value.indexOf(':')
		return manufacturer && colon >= 0 && normalizeName(value.slice(0, colon)) === normalizeName(manufacturer)
			? value.slice(colon + 1).trim()
			: value.trim()
	}
	const displayProducts = [...new Set(products.map(productName))].filter(Boolean)
	const extraProducts =
		displayProducts.length === 1 && normalizeName(displayProducts[0]) === normalizeName(productName(moduleName))
			? []
			: displayProducts

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

			<div className="secondary-panel-simple-body p-4 space-y-4 overflow-y-auto flex-1">
				<div className="space-y-4">
					{extraProducts.length > 0 && (
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
					)}
					<div className="flex flex-wrap items-center gap-3 text-xs">
						{helpPath && (
							<button
								type="button"
								className="inline-flex items-center gap-1.5 text-action-text hover:text-body hover:underline cursor-pointer"
								onClick={() =>
									helpViewer.current?.showFromUrl(moduleType, moduleId, version?.versionId ?? '', helpPath)
								}
							>
								<FontAwesomeIcon icon={faFileLines} />
								Docs
							</button>
						)}
						{moduleStoreBaseInfo?.githubUrl && (
							<a
								target="_blank"
								rel="noreferrer"
								href={moduleStoreBaseInfo.githubUrl}
								className="inline-flex items-center gap-1.5 text-muted hover:text-body"
							>
								<FontAwesomeIcon icon={faGithub} />
								GitHub
							</a>
						)}
						{moduleStoreBaseInfo && (
							<a
								target="_blank"
								rel="noreferrer"
								href={moduleStoreBaseInfo.storeUrl}
								className="inline-flex items-center gap-1.5 text-muted hover:text-body"
							>
								<FontAwesomeIcon icon={faStore} />
								Store
							</a>
						)}
						{issueUrl && (
							<a
								target="_blank"
								rel="noreferrer"
								href={issueUrl}
								className="inline-flex items-center gap-1.5 text-muted hover:text-body no-underline"
							>
								<FontAwesomeIcon icon={faBug} />
								Known issues
							</a>
						)}
					</div>
				</div>
				{moduleStoreBaseInfo?.deprecationReason && (
					<StaticAlert color="warning">
						<strong>Deprecated module</strong>
						<p className="mb-0 mt-1">{moduleStoreBaseInfo.deprecationReason}</p>
					</StaticAlert>
				)}
				{moduleStoreInfo?.updateWarning && <StaticAlert color="danger">{moduleStoreInfo.updateWarning}</StaticAlert>}
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

				<ModuleVersionsTable moduleType={moduleType} moduleId={moduleId} moduleStoreInfo={moduleStoreInfo} />
			</div>
		</>
	)
})
