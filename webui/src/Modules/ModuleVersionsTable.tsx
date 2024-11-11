import React, { useCallback, useContext, useState } from 'react'
import { socketEmitPromise } from '../util.js'
import { CButton, CButtonGroup } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faLock,
	faPlus,
	faQuestion,
	faStar,
	faSync,
	faToiletsPortable,
	faTrash,
	faWarning,
} from '@fortawesome/free-solid-svg-icons'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import type { NewClientModuleInfo, NewClientModuleVersionInfo2 } from '@companion-app/shared/Model/ModuleInfo.js'
import { ModuleStoreModuleInfoStore, ModuleStoreModuleInfoVersion } from '@companion-app/shared/Model/ModulesStore.js'
import semver from 'semver'
import { isModuleApiVersionCompatible } from '@companion-app/shared/ModuleApiVersionCheck.js'
import { ModuleVersionUsageIcon } from './ModuleVersionUsageIcon.js'
import { useTableVisibilityHelper, VisibilityButton } from '../Components/TableVisibility.js'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime.js'

dayjs.extend(relativeTime)

interface ModuleVersionsTableProps {
	moduleInfo: NewClientModuleInfo
	moduleStoreInfo: ModuleStoreModuleInfoStore | null
}

export const ModuleVersionsTable = observer(function ModuleVersionsTable({
	moduleInfo,
	moduleStoreInfo,
}: ModuleVersionsTableProps) {
	const allVersionsSet = new Set<string>()
	const installedModuleVersions = new Map<string, NewClientModuleVersionInfo2>()
	for (const version of moduleInfo.installedVersions) {
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

	const visibleVersions = useTableVisibilityHelper<VisibleVersionsState>(
		`modules_visible_versions:${moduleInfo.baseInfo.id}`,
		{
			availableStable: true,
			availableDeprecated: false,
			availablePrerelease: false,
		}
	)

	return (
		<table className="table-tight table-responsive-sm">
			<thead>
				<tr>
					<th>Version</th>
					<th>&nbsp;</th>
					<th colSpan={3} className="fit">
						<CButtonGroup className="table-header-buttons">
							<VisibilityButton {...visibleVersions} keyId="availableStable" color="success" label="Stable" />
							<VisibilityButton {...visibleVersions} keyId="availablePrerelease" color="warning" label="Prerelease" />
							<VisibilityButton {...visibleVersions} keyId="availableDeprecated" color="danger" label="Deprecated" />
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
						if (storeInfo.deprecationReason && !visibleVersions.visiblity.availableDeprecated) return null
						if (storeInfo.isPrerelease && !visibleVersions.visiblity.availablePrerelease) return null

						if (
							!storeInfo.deprecationReason &&
							!storeInfo.isPrerelease &&
							!installedInfo &&
							!visibleVersions.visiblity.availableStable
						)
							return null
					}

					return (
						<ModuleVersionRow
							key={versionId}
							moduleId={moduleInfo.baseInfo.id}
							versionId={versionId}
							storeInfo={storeInfo}
							installedInfo={installedInfo}
							isLatestStable={!!moduleInfo.stableVersion && moduleInfo.stableVersion.versionId === versionId}
							isLatestPrerelease={
								!!moduleInfo.prereleaseVersion && moduleInfo.prereleaseVersion.versionId === versionId
							}
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
	availablePrerelease: boolean
}

interface ModuleVersionRowProps {
	moduleId: string
	versionId: string
	installedInfo: NewClientModuleVersionInfo2 | undefined
	storeInfo: ModuleStoreModuleInfoVersion | undefined
	isLatestStable: boolean
	isLatestPrerelease: boolean
}

const ModuleVersionRow = observer(function ModuleVersionRow({
	moduleId,
	versionId,
	installedInfo,
	storeInfo,
	isLatestStable,
	isLatestPrerelease,
}: ModuleVersionRowProps) {
	if (!storeInfo && !installedInfo) return null // Should never happen

	return (
		<tr>
			<td>
				{installedInfo ? (
					<ModuleUninstallButton moduleId={moduleId} versionId={versionId} isBuiltin={installedInfo.isBuiltin} />
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
				{storeInfo?.isPrerelease && <FontAwesomeIcon icon={faQuestion} title="Prerelease" />}
				{storeInfo?.deprecationReason && <FontAwesomeIcon icon={faWarning} title="Deprecated" />}
			</td>
			<td>
				{!!storeInfo && (
					<>
						Released <LastUpdatedTimestamp releasedAt={storeInfo.releasedAt} />
					</>
				)}
			</td>
			<td>
				{isLatestStable && <FontAwesomeIcon icon={faStar} title="Latest stable" />}
				{isLatestPrerelease && <FontAwesomeIcon icon={faQuestion} title="Latest prerelease" />}

				<ModuleVersionUsageIcon moduleId={moduleId} moduleVersionId={versionId} />
			</td>
		</tr>
	)
})

function LastUpdatedTimestamp({ releasedAt }: { releasedAt: number | undefined }) {
	let releaseStr = 'Unknown'
	let titleStr: string | undefined = undefined
	if (releasedAt !== undefined && releasedAt > 0) {
		releaseStr = dayjs(releasedAt).fromNow()
		titleStr = dayjs(releasedAt).format('YYYY-MM-DD')
	}

	return <span title={titleStr}>{releaseStr}</span>
}

interface ModuleUninstallButtonProps {
	moduleId: string
	versionId: string
	isBuiltin: boolean
}

function ModuleUninstallButton({ moduleId, versionId, isBuiltin }: ModuleUninstallButtonProps) {
	const { socket, notifier } = useContext(RootAppStoreContext)

	const [isRunningInstallOrUninstall, setIsRunningInstallOrUninstall] = useState(false)

	const doRemove = useCallback(() => {
		setIsRunningInstallOrUninstall(true)
		socketEmitPromise(socket, 'modules:uninstall-store-module', [moduleId, versionId])
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

	if (isBuiltin) {
		return <FontAwesomeIcon className="disabled" icon={faLock} title="Version cannot be removed" />
	}

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
		socketEmitPromise(socket, 'modules:install-store-module', [moduleId, versionId])
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
				className="disabled"
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
