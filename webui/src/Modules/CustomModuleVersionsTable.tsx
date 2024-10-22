import React, { useCallback, useContext, useState } from 'react'
import { socketEmitPromise } from '../util.js'
import { CButton } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle, faSync, faTrash } from '@fortawesome/free-solid-svg-icons'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import type { NewClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { NonIdealState } from '../Components/NonIdealState.js'
import { ModuleVersionUsageIcon } from './ModuleVersionUsageIcon.js'

interface CustomModuleVersionsTableProps {
	moduleInfo: NewClientModuleInfo
}

export const CustomModuleVersionsTable = observer(function CustomModuleVersionsTable({
	moduleInfo,
}: CustomModuleVersionsTableProps) {
	return (
		<table className="table-tight table-responsive-sm">
			<thead>
				<tr>
					<th>Version</th>
					<th colSpan={3} className="fit">
						&nbsp;
					</th>
				</tr>
			</thead>
			<tbody>
				{moduleInfo.customVersions.map(
					(versionInfo) =>
						versionInfo.version.id && (
							<ModuleVersionRow
								key={versionInfo.version.id}
								moduleId={moduleInfo.baseInfo.id}
								versionId={versionInfo.version.id}
							/>
						)
				)}
				{moduleInfo.customVersions.length === 0 && (
					<tr>
						<td colSpan={4}>
							<NonIdealState icon={faQuestionCircle}>
								No custom versions of this module have been installed.
								<br />
								You can add some with the button in the left panel.
							</NonIdealState>
						</td>
					</tr>
				)}
			</tbody>
		</table>
	)
})

interface ModuleVersionRowProps {
	moduleId: string
	versionId: string
}

const ModuleVersionRow = observer(function ModuleVersionRow({ moduleId, versionId }: ModuleVersionRowProps) {
	return (
		<tr>
			<td>
				<ModuleUninstallButton moduleId={moduleId} versionId={versionId} />
			</td>
			<td>{versionId}</td>
			<td>
				<ModuleVersionUsageIcon
					moduleId={moduleId}
					moduleVersionMode="custom"
					moduleVersionId={versionId}
					isLatestStable={false}
					isLatestPrerelease={false}
				/>
			</td>
		</tr>
	)
})

interface ModuleUninstallButtonProps {
	moduleId: string
	versionId: string
}

function ModuleUninstallButton({ moduleId, versionId }: ModuleUninstallButtonProps) {
	const { socket, notifier } = useContext(RootAppStoreContext)

	const [isRunningInstallOrUninstall, setIsRunningInstallOrUninstall] = useState(false)

	const doRemove = useCallback(() => {
		setIsRunningInstallOrUninstall(true)
		socketEmitPromise(socket, 'modules:uninstall-custom-module', [moduleId, versionId])
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
