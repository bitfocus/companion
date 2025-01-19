import React, { useCallback, useContext, useState } from 'react'
import { CButton, CButtonGroup } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faAsterisk,
	faPlus,
	faQuestionCircle,
	faSync,
	faToiletsPortable,
	faTrash,
	faWarning,
} from '@fortawesome/free-solid-svg-icons'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import type { ClientModuleVersionInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { ModuleStoreModuleInfoStore, ModuleStoreModuleInfoVersion } from '@companion-app/shared/Model/ModulesStore.js'
import semver from 'semver'
import { isModuleApiVersionCompatible } from '@companion-app/shared/ModuleApiVersionCheck.js'
import { ModuleVersionUsageIcon } from './ModuleVersionUsageIcon.js'
import { useTableVisibilityHelper, VisibilityButton } from '../Components/TableVisibility.js'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime.js'

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

	const allVersionNumbers = Array.from(allVersionsSet).sort((a, b) => semver.compare(b, a))

	const visibleVersions = useTableVisibilityHelper<VisibleVersionsState>(`modules_visible_versions:${moduleId}`, {
		availableStable: true,
		availableDeprecated: false,
		availableBeta: false,
	})

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
				{allVersionNumbers.map((versionId) => {
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
							moduleId={moduleId}
							versionId={versionId}
							storeInfo={storeInfo}
							installedInfo={installedInfo}
						/>
					)
				})}
				{/* {hiddenCount > 0 && (
			<tr>
				<td colSpan={4} style={{ padding: '10px 5px' }}>
					<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'red' }} />
					<strong>{hiddenCount} Modules are hidden</strong>
				</td>
			</tr>
		)} */}
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
	moduleId: string
	versionId: string
	installedInfo: ClientModuleVersionInfo | undefined
	storeInfo: ModuleStoreModuleInfoVersion | undefined
}

const ModuleVersionRow = observer(function ModuleVersionRow({
	moduleId,
	versionId,
	installedInfo,
	storeInfo,
}: ModuleVersionRowProps) {
	const { helpViewer } = useContext(RootAppStoreContext)

	const versionDisplayName = installedInfo?.versionId ?? storeInfo?.id ?? ''
	const helpPath = installedInfo?.helpPath ?? storeInfo?.helpUrl

	const doShowHelp = useCallback(() => {
		if (!helpPath) return
		helpViewer.current?.showFromUrl(moduleId, versionDisplayName, helpPath)
	}, [helpViewer, moduleId, versionDisplayName, helpPath])

	if (!storeInfo && !installedInfo) return null // Should never happen

	return (
		<tr>
			<td>
				{installedInfo ? (
					<ModuleUninstallButton moduleId={moduleId} versionId={versionId} />
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
				{storeInfo?.releaseChannel === 'beta' && (
					<FontAwesomeIcon className="pad-left" icon={faAsterisk} title="Beta" />
				)}
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
				<ModuleVersionUsageIcon moduleId={moduleId} moduleVersionId={versionId} isInstalled={!!installedInfo} />
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
}

function ModuleUninstallButton({ moduleId, versionId }: ModuleUninstallButtonProps) {
	const { socket, notifier } = useContext(RootAppStoreContext)

	const [isRunningInstallOrUninstall, setIsRunningInstallOrUninstall] = useState(false)

	const doRemove = useCallback(() => {
		setIsRunningInstallOrUninstall(true)
		socket
			.emitPromise('modules:uninstall-store-module', [moduleId, versionId])
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
	}, [socket, moduleId, versionId])

	return (
		<CButton color="white" disabled={isRunningInstallOrUninstall} onClick={doRemove}>
			{isRunningInstallOrUninstall ? (
				<FontAwesomeIcon icon={faSync} spin title="Removing" />
			) : (
				<FontAwesomeIcon icon={faTrash} title="Remove version" />
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
	const { socket, notifier } = useContext(RootAppStoreContext)

	const [isRunningInstallOrUninstall, setIsRunningInstallOrUninstall] = useState(false)

	const doInstall = useCallback(() => {
		setIsRunningInstallOrUninstall(true)
		socket
			.emitPromise('modules:install-store-module', [moduleId, versionId], 30000)
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
	}, [socket, moduleId, versionId])

	if (!hasTarUrl) {
		return <FontAwesomeIcon icon={faToiletsPortable} className="disabled" title="Module is no longer available" />
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
