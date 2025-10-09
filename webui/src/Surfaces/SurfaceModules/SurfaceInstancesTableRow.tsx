import { CFormSwitch, CPopover, CButtonGroup, CButton } from '@coreui/react'
import {
	faExclamationTriangle,
	faQuestionCircle,
	faBug,
	faTerminal,
	faTrash,
	faEllipsisV,
	faFlask,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useContext, useCallback } from 'react'
import { Tuck } from '~/Components/Tuck.js'
import { windowLinkOpen } from '~/Helpers/Window.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { UpdateConnectionToLatestButton } from '../UpdateConnectionToLatestButton.js'
import { getModuleVersionInfoForConnection } from '../Util.js'
import { ClientConnectionConfigWithId } from './SurfaceInstanceList.js'
import { ConnectionStatusCell } from './ConnectionStatusCell.js'
import { useSurfaceInstanceListContext } from './SurfaceInstancesListContext.js'
import { isCollectionEnabled } from '~/Resources/util.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'

interface SurfaceInstancesTableRowProps {
	instance: ClientConnectionConfigWithId
	isSelected: boolean
}
export const SurfaceInstancesTableRow = observer(function SurfaceInstancesTableRow({
	instance: connection,
	isSelected,
}: SurfaceInstancesTableRowProps) {
	const { helpViewer, modules, connections } = useContext(RootAppStoreContext)
	const { deleteModalRef, configureInstance } = useSurfaceInstanceListContext()

	const id = connection.id
	const moduleInfo = modules.modules.get(connection.instance_type)

	const isEnabled = connection.enabled === undefined || connection.enabled

	const showAsEnabled = isEnabled && isCollectionEnabled(connections.rootCollections(), connection.collectionId)

	const deleteMutation = useMutationExt(trpc.instances.connections.delete.mutationOptions())
	const setEnabledMutation = useMutationExt(trpc.instances.connections.setEnabled.mutationOptions())

	const doDelete = useCallback(() => {
		deleteModalRef.current?.show(
			'Delete connection',
			[
				`Are you sure you want to delete "${connection.label}"?`,
				'This will remove all actions and feedbacks associated with this connection.',
			],
			'Delete',
			() => {
				deleteMutation.mutateAsync({ connectionId: id }).catch((e) => {
					console.error('Delete failed', e)
				})
				configureInstance(null)
			}
		)
	}, [deleteMutation, deleteModalRef, id, connection.label, configureInstance])

	const doToggleEnabled = useCallback(() => {
		setEnabledMutation.mutateAsync({ connectionId: id, enabled: !isEnabled }).catch((e) => {
			console.error('Set enabled failed', e)
		})
	}, [setEnabledMutation, id, isEnabled])

	const editClickId = isSelected ? null : id // If this row is selected, don't allow editing on click, as it will close the selection
	const doEdit = useCallback(() => configureInstance(editClickId), [configureInstance, editClickId])

	const openBugUrl = useCallback(() => {
		const url = moduleInfo?.display?.bugUrl
		if (url) windowLinkOpen({ href: url })
	}, [moduleInfo])

	const moduleVersion = getModuleVersionInfoForConnection(moduleInfo, connection.moduleVersionId)

	const doShowHelp = useCallback(
		() =>
			moduleVersion?.helpPath &&
			helpViewer.current?.showFromUrl(connection.instance_type, moduleVersion.versionId, moduleVersion.helpPath),
		[helpViewer, connection.instance_type, moduleVersion]
	)

	const moduleDisplayName = moduleInfo
		? `${moduleInfo.display.manufacturer ?? ''}: ${moduleInfo.display.products?.join('; ') ?? ''}`
		: connection.instance_type

	return (
		<div className="flex flex-row align-items-center gap-2 hand">
			<div onClick={doEdit} className="flex flex-column grow" style={{ minWidth: 0 }}>
				<b>{connection.label}</b>
				<span className="auto-ellipsis" title={moduleDisplayName}>
					{moduleDisplayName}
				</span>
			</div>

			<div onClick={doEdit} className="no-break">
				{moduleVersion?.isLegacy && (
					<>
						<FontAwesomeIcon
							icon={faExclamationTriangle}
							color="#f80"
							title="This module has not been updated for Companion 3.0, and may not work fully"
						/>{' '}
					</>
				)}
				{moduleVersion?.isBeta && (
					<>
						<FontAwesomeIcon icon={faFlask} title="Beta" />{' '}
					</>
				)}
				{moduleVersion?.displayName ?? connection.moduleVersionId}

				<UpdateConnectionToLatestButton connection={connection} />
			</div>
			<div onClick={doEdit} className="ms-2">
				<ConnectionStatusCell isEnabled={showAsEnabled} status={connection.status} />
			</div>
			<div className="flex">
				<CFormSwitch
					className="ms-2"
					disabled={!moduleInfo || !moduleVersion}
					color="success"
					checked={isEnabled}
					onChange={doToggleEnabled}
					size="xl"
					title={isEnabled ? 'Disable connection' : 'Enable connection'}
				/>
				<CPopover
					trigger="focus"
					placement="right"
					style={{ backgroundColor: 'white' }}
					content={
						<>
							{/* Note: the popover closing due to focus loss stops mouseup/click events propagating */}
							<CButtonGroup vertical>
								<CButton
									onMouseDown={doShowHelp}
									color="secondary"
									title="Help"
									disabled={!moduleVersion?.helpPath}
									style={{ textAlign: 'left' }}
								>
									<Tuck>
										<FontAwesomeIcon icon={faQuestionCircle} />
									</Tuck>
									Help
								</CButton>

								<CButton
									onMouseDown={openBugUrl}
									color="secondary"
									title="Issue Tracker"
									disabled={!moduleInfo?.display?.bugUrl}
									style={{ textAlign: 'left' }}
								>
									<Tuck>
										<FontAwesomeIcon icon={faBug} />
									</Tuck>
									Known issues
								</CButton>

								<CButton
									onMouseDown={() => windowLinkOpen({ href: `/connection-debug/${id}`, title: 'View debug log' })}
									title="Logs"
									color="secondary"
									style={{ textAlign: 'left' }}
								>
									<Tuck>
										<FontAwesomeIcon icon={faTerminal} />
									</Tuck>
									View logs
								</CButton>

								<CButton onMouseDown={doDelete} title="Delete" color="secondary" style={{ textAlign: 'left' }}>
									<Tuck>
										<FontAwesomeIcon icon={faTrash} />
									</Tuck>
									Delete
								</CButton>
							</CButtonGroup>
						</>
					}
				>
					<CButton color="secondary" style={{ padding: '3px 8px' }} onClick={(e) => e.currentTarget.focus()}>
						<FontAwesomeIcon icon={faEllipsisV} />
					</CButton>
				</CPopover>
			</div>
		</div>
	)
})
