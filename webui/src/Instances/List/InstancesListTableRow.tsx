import { CPopover } from '@coreui/react'
import {
	faBug,
	faEllipsisV,
	faExclamationTriangle,
	faFlask,
	faQuestionCircle,
	faTerminal,
	faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext } from 'react'
import type { ClientInstanceConfigBase } from '@companion-app/shared/Model/Instance.js'
import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'
import { Button, ButtonGroup } from '~/Components/Button'
import { SwitchInputField } from '~/Components/SwitchInputField'
import { Tuck } from '~/Components/Tuck'
import { windowLinkOpen } from '~/Helpers/Window'
import { MyErrorBoundary } from '~/Resources/Error'
import { isCollectionEnabled, makeAbsolutePath } from '~/Resources/util'
import type { GenericCollectionsStore } from '~/Stores/GenericCollectionsStore'
import { RootAppStoreContext } from '~/Stores/RootAppStore'
import { UpdateInstanceToLatestBadge } from '../UpdateInstanceToLatestBadge'
import { getModuleVersionInfo } from '../Util'
import { InstanceTableStatusCell } from './InstanceTableStatusCell'

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
	cannotEnableReason?: string | null
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
	cannotEnableReason,
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

	const moduleDisplayName = moduleInfo ? moduleInfo.display.name : instance.moduleId

	const canToggleEnabled = !cannotEnableReason || isEnabled
	const toggleEnabledTitle = cannotEnableReason
		? cannotEnableReason
		: isEnabled
			? `Disable ${labelStr}`
			: `Enable ${labelStr}`

	return (
		<div className="flex flex-row align-items-center gap-2 hand" title={`Click to configure the ${moduleDisplayName}.`}>
			<div onClick={doEdit} className="flex flex-column grow" style={{ minWidth: 0 }}>
				<b>{instance.label}</b>
				<span className="auto-ellipsis">{moduleDisplayName}</span>
			</div>

			<div onClick={doEdit} className="no-break">
				<MyErrorBoundary>
					{moduleVersion?.isLegacy && (
						<span title="This module has not been updated for Companion 3.0, and may not work fully">
							<FontAwesomeIcon icon={faExclamationTriangle} color="#f80" />{' '}
						</span>
					)}
					{moduleVersion?.isBeta && (
						<span title="Beta">
							<FontAwesomeIcon icon={faFlask} />{' '}
						</span>
					)}
					{moduleVersion?.displayName ?? instance.moduleVersionId}

					<UpdateInstanceToLatestBadge instance={instance} />
				</MyErrorBoundary>
			</div>
			<div onClick={doEdit} className="ms-2">
				<InstanceTableStatusCell isEnabled={showAsEnabled} status={instanceStatus} />
			</div>
			<div className="flex">
				<div className="ms-2" title={toggleEnabledTitle}>
					<SwitchInputField
						value={isEnabled}
						setValue={doToggleEnabled}
						disabled={!moduleInfo || !moduleVersion || !canToggleEnabled}
					/>
				</div>
				<CPopover
					trigger="focus"
					placement="right"
					style={{ backgroundColor: 'white' }}
					content={
						<>
							{/* Note: the popover closing due to focus loss stops mouseup/click events propagating */}
							<ButtonGroup vertical>
								<Button
									onMouseDown={doShowHelp}
									color="secondary"
									title="Help"
									disabled={!moduleVersion?.helpPath}
									className="text-start"
								>
									<Tuck>
										<FontAwesomeIcon icon={faQuestionCircle} />
									</Tuck>
									Help
								</Button>

								<Button
									onMouseDown={openBugUrl}
									color="secondary"
									title="Issue Tracker"
									disabled={!moduleInfo?.display?.bugUrl}
									className="text-start"
								>
									<Tuck>
										<FontAwesomeIcon icon={faBug} />
									</Tuck>
									Known issues
								</Button>

								{extraMenuItems}

								{!!debugLogUrl && (
									<Button
										onMouseDown={() => windowLinkOpen({ href: makeAbsolutePath(debugLogUrl), title: 'View debug log' })}
										title="Logs"
										color="secondary"
										className="text-start"
									>
										<Tuck>
											<FontAwesomeIcon icon={faTerminal} />
										</Tuck>
										View logs
									</Button>
								)}

								<Button onMouseDown={doDelete} title="Delete" color="secondary" className="text-start">
									<Tuck>
										<FontAwesomeIcon icon={faTrash} />
									</Tuck>
									Delete
								</Button>
							</ButtonGroup>
						</>
					}
				>
					<Button
						color="secondary"
						className="py-1 px-2"
						onClick={(e) => e.currentTarget.focus()}
						title="Click for additional options."
						aria-label="Click for additional options."
					>
						<FontAwesomeIcon icon={faEllipsisV} />
					</Button>
				</CPopover>
			</div>
		</div>
	)
})
