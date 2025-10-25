import type { ClientInstanceConfigBase } from '@companion-app/shared/Model/Instance.js'
import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'
import { CFormSwitch, CPopover, CButtonGroup, CButton } from '@coreui/react'
import {
	faExclamationTriangle,
	faFlask,
	faQuestionCircle,
	faBug,
	faTerminal,
	faTrash,
	faEllipsisV,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useContext, useCallback } from 'react'
import { Tuck } from '~/Components/Tuck'
import { windowLinkOpen } from '~/Helpers/Window'
import { MyErrorBoundary } from '~/Resources/Error'
import { isCollectionEnabled, makeAbsolutePath } from '~/Resources/util'
import type { GenericCollectionsStore } from '~/Stores/GenericCollectionsStore'
import { RootAppStoreContext } from '~/Stores/RootAppStore'
import { InstanceTableStatusCell } from './InstanceTableStatusCell'
import { UpdateInstanceToLatestBadge } from '../UpdateInstanceToLatestBadge'
import { getModuleVersionInfo } from '../Util'

export interface InstancesListTableRowProps<TMetaData extends { enabled?: boolean }> {
	collectionsStore: GenericCollectionsStore<TMetaData>
	instance: ClientInstanceConfigBase
	instanceStatus: InstanceStatusEntry | undefined
	extraMenuItems?: React.JSX.Element
	labelStr: string
	doDelete: () => void
	doEdit: () => void
	doToggleEnabled: () => void
	debugLogUrl: string | null
}

export const InstancesListTableRow = observer(function InstancesListTableRow<TMetaData extends { enabled?: boolean }>({
	collectionsStore,
	instance,
	instanceStatus,
	extraMenuItems,
	labelStr,
	doDelete,
	doEdit,
	doToggleEnabled,
	debugLogUrl,
}: InstancesListTableRowProps<TMetaData>) {
	const { helpViewer, modules } = useContext(RootAppStoreContext)

	const moduleInfo = modules.getModuleInfo(instance.moduleType, instance.moduleId)

	const isEnabled = instance.enabled === undefined || instance.enabled

	const showAsEnabled = isEnabled && isCollectionEnabled(collectionsStore.rootCollections(), instance.collectionId)

	const openBugUrl = useCallback(() => {
		const url = moduleInfo?.display?.bugUrl
		if (url) windowLinkOpen({ href: url })
	}, [moduleInfo])

	const moduleVersion = getModuleVersionInfo(moduleInfo, instance.moduleVersionId)

	const doShowHelp = useCallback(
		() =>
			moduleVersion?.helpPath &&
			helpViewer.current?.showFromUrl(
				instance.moduleType,
				instance.moduleId,
				moduleVersion.versionId,
				moduleVersion.helpPath
			),
		[helpViewer, instance.moduleType, instance.moduleId, moduleVersion]
	)

	const moduleDisplayName = moduleInfo
		? `${moduleInfo.display.manufacturer ?? ''}: ${moduleInfo.display.products?.join('; ') ?? ''}`
		: instance.moduleId

	return (
		<div className="flex flex-row align-items-center gap-2 hand">
			<div onClick={doEdit} className="flex flex-column grow" style={{ minWidth: 0 }}>
				<b>{instance.label}</b>
				<span className="auto-ellipsis" title={moduleDisplayName}>
					{moduleDisplayName}
				</span>
			</div>

			<div onClick={doEdit} className="no-break">
				<MyErrorBoundary>
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
					{moduleVersion?.displayName ?? instance.moduleVersionId}

					<UpdateInstanceToLatestBadge instance={instance} />
				</MyErrorBoundary>
			</div>
			<div onClick={doEdit} className="ms-2">
				<InstanceTableStatusCell isEnabled={showAsEnabled} status={instanceStatus} />
			</div>
			<div className="flex">
				<CFormSwitch
					className="ms-2"
					disabled={!moduleInfo || !moduleVersion}
					color="success"
					checked={isEnabled}
					onChange={doToggleEnabled}
					size="xl"
					title={isEnabled ? `Disable ${labelStr}` : `Enable ${labelStr}`}
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

								{extraMenuItems}

								{!!debugLogUrl && (
									<CButton
										onMouseDown={() => windowLinkOpen({ href: makeAbsolutePath(debugLogUrl), title: 'View debug log' })}
										title="Logs"
										color="secondary"
										style={{ textAlign: 'left' }}
									>
										<Tuck>
											<FontAwesomeIcon icon={faTerminal} />
										</Tuck>
										View logs
									</CButton>
								)}

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
