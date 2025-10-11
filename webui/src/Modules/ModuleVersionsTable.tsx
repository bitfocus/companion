import React, { useCallback, useContext, useState } from 'react'
import { CButton, CButtonGroup } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faEyeSlash,
	faPlus,
	faQuestionCircle,
	faSync,
	faCircleMinus,
	faTrash,
	faWarning,
	faFlask,
} from '@fortawesome/free-solid-svg-icons'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import type { ClientModuleVersionInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { ModuleStoreModuleInfoStore, ModuleStoreModuleInfoVersion } from '@companion-app/shared/Model/ModulesStore.js'
import semver from 'semver'
import { isModuleApiVersionCompatible } from '@companion-app/shared/ModuleApiVersionCheck.js'
import { ModuleVersionUsageIcon } from './ModuleVersionUsageIcon.js'
import { useTableVisibilityHelper, VisibilityButton } from '~/Components/TableVisibility.js'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'

dayjs.extend(relativeTime)

interface ModuleVersionsTableProps {
	moduleId: string
	moduleStoreInfo: ModuleStoreModuleInfoStore | null
}

export const ModuleVersionsTable = observer(function ModuleVersionsTable({
	moduleId,
	moduleStoreInfo,
}: ModuleVersionsTableProps) {
	const { modules } = useContext(RootAppStoreContext)
	const moduleInstalledInfo = modules.modules.get(moduleId)

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
		availableDeprecated: false,
		availableBeta: false,
	})
	const allHidden = Object.values(visibleVersions.visibility).every((v) => !v)

	const versionRows = allVersionNumbers
		.map((versionId) => {
			const storeInfo = storeModuleVersions.get(versionId)
			const installedInfo = installedModuleVersions.get(versionId)
			if (storeInfo) {
				// Hide based on visibility settings
				if (storeInfo.deprecationReason && !visibleVersions.visibility.availableDeprecated) return null
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
					moduleType={modules.moduleType}
					moduleId={moduleId}
					versionId={versionId}
					storeInfo={storeInfo}
					installedInfo={installedInfo}
				/>
			)
		})
		.filter((r) => !!r)

	return (
		<table className="table-tight table-responsive-sm">
			<thead>
				<tr>
					<th>Version</th>
					<th>&nbsp;</th>
					<th colSpan={3} className="fit">
						<CButtonGroup className="table-header-buttons">
							<VisibilityButton {...visibleVersions} keyId="availableStable" color="success" label="Stable" />
							<VisibilityButton {...visibleVersions} keyId="availableBeta" color="warning" label="Beta" />
							<VisibilityButton {...visibleVersions} keyId="availableDeprecated" color="primary" label="Deprecated" />
						</CButtonGroup>
					</th>
				</tr>
			</thead>
			<tbody>
				{versionRows}
				{!allHidden && versionRows.length === 0 && (
					<tr>
						<td colSpan={4} style={{ padding: '10px 5px' }}>
							<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'red' }} />
							<strong>There are no matching versions for the current filters</strong>
						</td>
					</tr>
				)}
				{allHidden && (
					<tr>
						<td colSpan={4} style={{ padding: '10px 5px' }}>
							<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'red' }} />
							<strong>All versions are hidden by the filters</strong>
						</td>
					</tr>
				)}
			</tbody>
		</table>
	)
})

interface VisibleVersionsState {
	availableStable: boolean
	availableDeprecated: boolean
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
	}, [helpViewer, moduleId, versionDisplayName, helpPath])

	if (!storeInfo && !installedInfo) return null // Should never happen

	let matchingConnections = 0
	for (const connection of connections.connections.values()) {
		if (connection.instance_type !== moduleId) continue

		if (versionId && connection.moduleVersionId === versionId) {
			matchingConnections++
		}
	}

	return (
		<tr>
			<td>
				{installedInfo ? (
					<ModuleUninstallButton moduleId={moduleId} versionId={versionId} disabled={matchingConnections > 0} />
				) : (
					<ModuleInstallButton
						moduleId={moduleId}
						versionId={versionId}
						apiVersion={storeInfo!.apiVersion}
						hasTarUrl={!!storeInfo?.tarUrl}
					/>
				)}
			</td>
			<td>
				{versionId}
				{storeInfo?.releaseChannel === 'beta' && <FontAwesomeIcon className="pad-left" icon={faFlask} title="Beta" />}
				{storeInfo?.deprecationReason && <FontAwesomeIcon className="pad-left" icon={faWarning} title="Deprecated" />}
			</td>
			<td>
				{!!storeInfo && (
					<>
						Released <LastUpdatedTimestamp releasedAt={storeInfo.releasedAt} />
					</>
				)}
			</td>
			<td>
				<ModuleVersionUsageIcon matchingConnections={matchingConnections} isInstalled={!!installedInfo} />
				{helpPath && (
					<div className="float_right" onClick={doShowHelp}>
						<FontAwesomeIcon icon={faQuestionCircle} />
					</div>
				)}
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
	moduleId: string
	versionId: string
	disabled: boolean
}

function ModuleUninstallButton({ moduleId, versionId, disabled }: ModuleUninstallButtonProps) {
	const { notifier } = useContext(RootAppStoreContext)

	const [isRunningInstallOrUninstall, setIsRunningInstallOrUninstall] = useState(false)

	const uninstallModuleMutation = useMutationExt(trpc.instances.modulesManager.uninstallModule.mutationOptions())
	const doRemove = useCallback(() => {
		setIsRunningInstallOrUninstall(true)
		uninstallModuleMutation
			.mutateAsync({
				moduleId,
				versionId,
			})
			.then((failureReason) => {
				if (failureReason) {
					console.error('Failed to uninstall module', failureReason)

					notifier.current?.show('Failed to uninstall module', failureReason, 5000)
				}
			})
			.catch((err) => {
				console.error('Failed to uninstall module', err)
			})
			.finally(() => {
				setIsRunningInstallOrUninstall(false)
			})
	}, [uninstallModuleMutation, notifier, moduleId, versionId])

	return (
		<CButton color="white" disabled={isRunningInstallOrUninstall || disabled} onClick={doRemove}>
			{isRunningInstallOrUninstall ? (
				<FontAwesomeIcon icon={faSync} spin title="Removing" />
			) : (
				<FontAwesomeIcon
					icon={faTrash}
					title={disabled ? 'Cannot remove version, it is in use by connections' : 'Remove version'}
				/>
			)}
		</CButton>
	)
}

interface ModuleInstallButtonProps {
	moduleId: string
	versionId: string
	apiVersion: string
	hasTarUrl: boolean
}

function ModuleInstallButton({ moduleId, versionId, apiVersion, hasTarUrl }: ModuleInstallButtonProps) {
	const { notifier } = useContext(RootAppStoreContext)

	const [isRunningInstallOrUninstall, setIsRunningInstallOrUninstall] = useState(false)

	const installStoreModuleMutation = useMutationExt(trpc.instances.modulesManager.installStoreModule.mutationOptions())
	const doInstall = useCallback(() => {
		setIsRunningInstallOrUninstall(true)
		installStoreModuleMutation // TODO: 30s timeout?
			.mutateAsync({
				moduleType: ModuleInstanceType.Connection,
				moduleId,
				versionId,
			})
			.then((failureReason) => {
				if (failureReason) {
					console.error('Failed to install module', failureReason)

					notifier.current?.show('Failed to install module', failureReason, 5000)
				}
			})
			.catch((err) => {
				console.error('Failed to install module', err)
			})
			.finally(() => {
				setIsRunningInstallOrUninstall(false)
			})
	}, [installStoreModuleMutation, notifier, moduleId, versionId])

	if (!hasTarUrl) {
		return (
			<FontAwesomeIcon icon={faCircleMinus} className="disabled button-size" title="Module is no longer available" />
		)
	}

	if (!isModuleApiVersionCompatible(apiVersion)) {
		return (
			<FontAwesomeIcon
				icon={faWarning}
				className="disabled button-size"
				title="Module is not compatible with this version of Companion"
			/>
		)
	}

	return (
		<CButton color="white" disabled={isRunningInstallOrUninstall} onClick={doInstall}>
			{isRunningInstallOrUninstall ? (
				<FontAwesomeIcon icon={faSync} spin title="Installing" />
			) : (
				<FontAwesomeIcon icon={faPlus} title="Install version" />
			)}
		</CButton>
	)
}
