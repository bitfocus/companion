import {
	faCircleMinus,
	faEyeSlash,
	faPlus,
	faQuestionCircle,
	faSync,
	faTrash,
	faWarning,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime.js'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useState } from 'react'
import semver from 'semver'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ClientModuleVersionInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type {
	ModuleStoreModuleInfoStore,
	ModuleStoreModuleInfoVersion,
} from '@companion-app/shared/Model/ModulesStore.js'
import { isSomeModuleApiVersionCompatible } from '@companion-app/shared/ModuleApiVersionCheck.js'
import { Button, ButtonGroup } from '~/Components/Button'
import { Table } from '~/Components/Table.js'
import { useTableVisibilityHelper } from '~/Components/TableVisibility.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ModuleVersionUsageIcon } from './ModuleVersionUsageIcon.js'

dayjs.extend(relativeTime)

interface ModuleVersionsTableProps {
	moduleType: ModuleInstanceType
	moduleId: string
	moduleStoreInfo: ModuleStoreModuleInfoStore | null
}

export const ModuleVersionsTable = observer(function ModuleVersionsTable({
	moduleType,
	moduleId,
	moduleStoreInfo,
}: ModuleVersionsTableProps) {
	const { modules } = useContext(RootAppStoreContext)
	const moduleInstalledInfo = modules.getModuleInfo(moduleType, moduleId)

	const allVersionsSet = new Set<string>()
	const installedModuleVersions = new Map<string, ClientModuleVersionInfo>()
	for (const version of moduleInstalledInfo?.installedVersions ?? []) {
		if (version.versionId) {
			installedModuleVersions.set(version.versionId, version)
			allVersionsSet.add(version.versionId)
		}
	}
	const storeModuleVersions = new Map<string, ModuleStoreModuleInfoVersion>()
	for (const version of moduleStoreInfo?.versions ?? []) {
		storeModuleVersions.set(version.id, version)
		allVersionsSet.add(version.id)
	}

	const allVersionNumbers = Array.from(allVersionsSet).sort((a, b) => semver.compare(b, a, true))

	const visibleVersions = useTableVisibilityHelper<VisibleVersionsState>(`modules_visible_versions:${moduleId}`, {
		availableStable: true,
		availableBeta: false,
	})
	const [showDeprecated, setShowDeprecated] = useState(false)
	const allHidden = Object.values(visibleVersions.visibility).every((v) => !v) && !showDeprecated

	const versionRows = allVersionNumbers
		.map((versionId) => {
			const storeInfo = storeModuleVersions.get(versionId)
			const installedInfo = installedModuleVersions.get(versionId)
			if (storeInfo) {
				// Hide based on visibility settings
				if (storeInfo.deprecationReason && !showDeprecated) return null
				if (storeInfo.releaseChannel === 'beta' && !visibleVersions.visibility.availableBeta) return null

				if (
					!storeInfo.deprecationReason &&
					storeInfo.releaseChannel === 'stable' &&
					!installedInfo &&
					!visibleVersions.visibility.availableStable
				)
					return null
			}

			return (
				<ModuleVersionRow
					key={versionId}
					moduleType={moduleType}
					moduleId={moduleId}
					versionId={versionId}
					storeInfo={storeInfo}
					installedInfo={installedInfo}
				/>
			)
		})
		.filter((r) => !!r)

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between gap-3">
				<h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-0">Module Versions</h4>
				<ButtonGroup className="shrink-0">
					<Button
						color={visibleVersions.visibility.availableStable ? 'primary' : 'secondary'}
						size="sm"
						active={visibleVersions.visibility.availableStable}
						onClick={() => visibleVersions.toggleVisibility('availableStable')}
					>
						Stable
					</Button>
					<Button
						color={visibleVersions.visibility.availableBeta ? 'primary' : 'secondary'}
						size="sm"
						active={visibleVersions.visibility.availableBeta}
						onClick={() => visibleVersions.toggleVisibility('availableBeta')}
					>
						Beta
					</Button>
					<Button
						color={showDeprecated ? 'primary' : 'secondary'}
						size="sm"
						active={showDeprecated}
						onClick={() => setShowDeprecated((visible) => !visible)}
					>
						Deprecated
					</Button>
				</ButtonGroup>
			</div>

			<div className="rounded-md border border-border/70 bg-surface overflow-hidden">
				<Table className="table-tight mb-0">
					<thead>
						<tr className="bg-surface-muted/40 border-b border-border/70 text-xs text-muted">
							<th className="w-12 py-2 px-3">Action</th>
							<th className="py-2 px-3">Version</th>
							<th className="py-2 px-3">Released</th>
							<th className="py-2 px-3 text-end w-20">Status</th>
						</tr>
					</thead>
					<tbody>
						{versionRows}
						{!allHidden && versionRows.length === 0 && (
							<tr>
								<td colSpan={4} className="p-3 text-xs text-muted">
									<div className="flex items-center gap-2">
										<FontAwesomeIcon icon={faEyeSlash} className="text-amber-500" />
										<span>There are no matching versions for the current filters.</span>
									</div>
								</td>
							</tr>
						)}
						{allHidden && (
							<tr>
								<td colSpan={4} className="p-3 text-xs text-muted">
									<div className="flex items-center gap-2">
										<FontAwesomeIcon icon={faEyeSlash} className="text-amber-500" />
										<span>All versions are hidden by active filter toggles.</span>
									</div>
								</td>
							</tr>
						)}
					</tbody>
				</Table>
			</div>
		</div>
	)
})

interface VisibleVersionsState {
	availableStable: boolean
	availableBeta: boolean
}

interface ModuleVersionRowProps {
	moduleType: ModuleInstanceType
	moduleId: string
	versionId: string
	installedInfo: ClientModuleVersionInfo | undefined
	storeInfo: ModuleStoreModuleInfoVersion | undefined
}

const ModuleVersionRow = observer(function ModuleVersionRow({
	moduleType,
	moduleId,
	versionId,
	installedInfo,
	storeInfo,
}: ModuleVersionRowProps) {
	const { helpViewer, connections } = useContext(RootAppStoreContext)

	const versionDisplayName = installedInfo?.versionId ?? storeInfo?.id ?? ''
	const helpPath = installedInfo?.helpPath ?? storeInfo?.helpUrl

	const doShowHelp = useCallback(() => {
		if (!helpPath) return
		helpViewer.current?.showFromUrl(moduleType, moduleId, versionDisplayName, helpPath)
	}, [helpViewer, moduleType, moduleId, versionDisplayName, helpPath])

	if (!storeInfo && !installedInfo) return null // Should never happen

	let matchingConnections = 0
	for (const connection of connections.connections.values()) {
		if (connection.moduleId !== moduleId) continue

		if (versionId && connection.moduleVersionId === versionId) {
			matchingConnections++
		}
	}

	return (
		<tr className="hover:bg-surface-muted/50 transition-colors">
			<td className="compact py-2 px-3 w-12">
				{installedInfo ? (
					<ModuleUninstallButton
						moduleType={moduleType}
						moduleId={moduleId}
						versionId={versionId}
						disabled={matchingConnections > 0}
					/>
				) : (
					<ModuleInstallButton
						moduleType={moduleType}
						moduleId={moduleId}
						versionId={versionId}
						apiVersion={storeInfo!.apiVersion}
						hasTarUrl={!!storeInfo?.tarUrl}
					/>
				)}
			</td>
			<td className="py-2 px-3 font-mono text-xs font-semibold text-body">
				<div className="flex items-center gap-1.5">
					<span>{versionId}</span>
					{storeInfo?.releaseChannel === 'beta' && (
						<span title="Beta" className="px-1.5 py-0.5 rounded text-3xs bg-amber-500/10 text-amber-600 font-sans">
							Beta
						</span>
					)}
					{storeInfo?.deprecationReason && (
						<span title="Deprecated" className="px-1.5 py-0.5 rounded text-3xs bg-rose-500/10 text-rose-600 font-sans">
							Deprecated
						</span>
					)}
				</div>
			</td>
			<td className="py-2 px-3 text-xs text-muted">
				{!!storeInfo && <LastUpdatedTimestamp releasedAt={storeInfo.releasedAt} />}
			</td>
			<td className="compact py-2 px-3 text-end w-20">
				<div className="flex items-center justify-end gap-1.5">
					<ModuleVersionUsageIcon matchingConnections={matchingConnections} isInstalled={!!installedInfo} />
					{helpPath && (
						<button
							type="button"
							onClick={doShowHelp}
							className="panel-icon-button panel-icon-button-sm"
							title="Show documentation"
						>
							<FontAwesomeIcon icon={faQuestionCircle} className="text-xs" />
						</button>
					)}
				</div>
			</td>
		</tr>
	)
})

function LastUpdatedTimestamp({ releasedAt }: { releasedAt: number | undefined }) {
	let releaseStr = 'at some point'
	let titleStr: string | undefined = undefined
	if (releasedAt !== undefined && releasedAt > 0) {
		releaseStr = dayjs(releasedAt).fromNow()
		titleStr = dayjs(releasedAt).format('YYYY-MM-DD')
	} else if (releasedAt === 0) {
		releaseStr = 'a long time ago'
		titleStr = 'Unknown'
	}

	return <span title={titleStr}>{releaseStr}</span>
}

interface ModuleUninstallButtonProps {
	moduleType: ModuleInstanceType
	moduleId: string
	versionId: string
	disabled: boolean
}

function ModuleUninstallButton({ moduleType, moduleId, versionId, disabled }: ModuleUninstallButtonProps) {
	const { notifier } = useContext(RootAppStoreContext)

	const [isRunningInstallOrUninstall, setIsRunningInstallOrUninstall] = useState(false)

	const uninstallModuleMutation = useMutationExt(trpc.instances.modulesManager.uninstallModule.mutationOptions())
	const doRemove = useCallback(() => {
		setIsRunningInstallOrUninstall(true)
		uninstallModuleMutation
			.mutateAsync({ moduleType, moduleId, versionId })
			.then((failureReason) => {
				if (failureReason) {
					console.error('Failed to uninstall module', failureReason)

					notifier.show('Failed to uninstall module', failureReason, 5000)
				}
			})
			.catch((err) => {
				console.error('Failed to uninstall module', err)
			})
			.finally(() => {
				setIsRunningInstallOrUninstall(false)
			})
	}, [uninstallModuleMutation, notifier, moduleType, moduleId, versionId])

	return (
		<Button
			color="secondary"
			size="sm"
			className="w-7 h-7 p-0 inline-flex items-center justify-center"
			disabled={isRunningInstallOrUninstall || disabled}
			onClick={doRemove}
		>
			{isRunningInstallOrUninstall ? (
				<FontAwesomeIcon icon={faSync} spin className="text-xs" />
			) : (
				<FontAwesomeIcon
					icon={faTrash}
					className="text-xs text-rose-500"
					title={disabled ? 'Cannot remove version, it is in use by connections' : 'Remove version'}
				/>
			)}
		</Button>
	)
}

interface ModuleInstallButtonProps {
	moduleType: ModuleInstanceType
	moduleId: string
	versionId: string
	apiVersion: string
	hasTarUrl: boolean
}

function ModuleInstallButton({ moduleType, moduleId, versionId, apiVersion, hasTarUrl }: ModuleInstallButtonProps) {
	const { notifier } = useContext(RootAppStoreContext)

	const [isRunningInstallOrUninstall, setIsRunningInstallOrUninstall] = useState(false)

	const installStoreModuleMutation = useMutationExt(trpc.instances.modulesManager.installStoreModule.mutationOptions())
	const doInstall = useCallback(() => {
		setIsRunningInstallOrUninstall(true)
		installStoreModuleMutation // TODO: 30s timeout?
			.mutateAsync({ moduleType, moduleId, versionId })
			.then((failureReason) => {
				if (failureReason) {
					console.error('Failed to install module', failureReason)

					notifier.show('Failed to install module', failureReason, 5000)
				}
			})
			.catch((err) => {
				console.error('Failed to install module', err)
			})
			.finally(() => {
				setIsRunningInstallOrUninstall(false)
			})
	}, [installStoreModuleMutation, notifier, moduleType, moduleId, versionId])

	if (!hasTarUrl) {
		return (
			<span
				title="Module is no longer available"
				className="inline-flex items-center justify-center w-7 h-7 text-muted"
			>
				<FontAwesomeIcon icon={faCircleMinus} className="text-xs" />
			</span>
		)
	}

	if (!isSomeModuleApiVersionCompatible(moduleType, apiVersion)) {
		return (
			<span
				title="Module is not compatible with this version of Companion"
				className="inline-flex items-center justify-center w-7 h-7 text-amber-500"
			>
				<FontAwesomeIcon icon={faWarning} className="text-xs" />
			</span>
		)
	}

	return (
		<Button
			color="secondary"
			size="sm"
			className="w-7 h-7 p-0 inline-flex items-center justify-center"
			disabled={isRunningInstallOrUninstall}
			onClick={doInstall}
		>
			{isRunningInstallOrUninstall ? (
				<FontAwesomeIcon icon={faSync} spin className="text-xs" />
			) : (
				<FontAwesomeIcon icon={faPlus} className="text-xs" title="Install version" />
			)}
		</Button>
	)
}
