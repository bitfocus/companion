import {
	faBars,
	faBug,
	faExclamationTriangle,
	faFlask,
	faQuestionCircle,
	faTerminal,
	faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext } from 'react'
import type { ClientInstanceConfigBase } from '@companion-app/shared/Model/Instance.js'
import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'
import { Popover } from '~/Components/Popover'
import { SwitchInputField } from '~/Components/SwitchInputField'
import { windowLinkOpen } from '~/Helpers/Window'
import { MyErrorBoundary } from '~/Resources/Error'
import { isCollectionEnabled, makeAbsolutePath } from '~/Resources/util'
import type { GenericCollectionsStore } from '~/Stores/GenericCollectionsStore'
import { RootAppStoreContext } from '~/Stores/RootAppStore'
import { UpdateInstanceToLatestBadge } from '../UpdateInstanceToLatestBadge'
import { getModuleVersionInfo } from '../Util'
import { instanceStatusTone } from './InstanceStatusHelpers.js'
import './InstancesListTableRow.css'
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
	isSelected?: boolean
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
	isSelected,
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

	// Only failures (and the in-progress "connecting" state, which modules report as an error) carry a
	// message worth showing under the name.
	const statusMessage =
		instanceStatus &&
		(instanceStatus.category === 'error' || instanceStatus.category === 'warning') &&
		instanceStatus.message
			? typeof instanceStatus.message === 'string'
				? instanceStatus.message
				: JSON.stringify(instanceStatus.message)
			: null

	return (
		<div
			className={classNames(
				'flex flex-row items-center gap-3 cursor-pointer py-2 px-3 rounded-lg transition-all',
				isSelected
					? 'bg-primary/10 font-semibold text-primary ring-1 ring-primary/30 shadow-xs'
					: 'hover:bg-surface-muted/60'
			)}
			title={`Click to configure the ${moduleDisplayName}.`}
		>
			<div onClick={doEdit} className="flex flex-col grow min-w-0 flex-1">
				<b className="truncate text-sm font-semibold text-body-strong">{instance.label}</b>
				<div className="flex items-center gap-1.5 text-xs text-muted/80 font-normal truncate">
					<span className="truncate">{moduleDisplayName}</span>
				</div>
				{statusMessage && (
					<span
						className="instance-status-message"
						data-tone={instanceStatusTone(instanceStatus)}
						title={statusMessage}
					>
						{statusMessage}
					</span>
				)}
			</div>

			<div
				onClick={doEdit}
				className="hidden lg:flex shrink-0 items-center justify-end gap-1 text-2xs text-muted/70 font-mono tabular-nums whitespace-nowrap table-cell-version"
			>
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
					<span className="truncate tabular-nums">{moduleVersion?.displayName ?? instance.moduleVersionId}</span>

					<UpdateInstanceToLatestBadge instance={instance} />
				</MyErrorBoundary>
			</div>

			<div onClick={doEdit} className="shrink-0 flex items-center justify-center">
				<InstanceTableStatusCell isEnabled={showAsEnabled} status={instanceStatus} />
			</div>

			<div className="shrink-0 flex items-center gap-1">
				<div title={toggleEnabledTitle}>
					<SwitchInputField
						id={undefined}
						value={isEnabled}
						setValue={doToggleEnabled}
						disabled={!moduleInfo || !moduleVersion || !canToggleEnabled}
					/>
				</div>
				<Popover.Root>
					<Popover.Trigger
						color={null}
						className="p-1.5 w-7 h-7 inline-flex items-center justify-center rounded-lg text-muted hover:text-body hover:bg-surface-muted transition-colors border-0 cursor-pointer"
						title="Click for additional options."
						aria-label="Click for additional options."
					>
						<FontAwesomeIcon icon={faBars} className="text-xs" />
					</Popover.Trigger>
					<Popover.Popup arrow side="right" align="center">
						<Popover.Item onClick={doShowHelp} title="Help" disabled={!moduleVersion?.helpPath}>
							<FontAwesomeIcon icon={faQuestionCircle} className="me-2 opacity-70" />
							Help
						</Popover.Item>

						<Popover.Item onClick={openBugUrl} title="Issue Tracker" disabled={!moduleInfo?.display?.bugUrl}>
							<FontAwesomeIcon icon={faBug} className="me-2 opacity-70" />
							Known issues
						</Popover.Item>

						{extraMenuItems}

						{!!debugLogUrl && (
							<Popover.Item
								onClick={() => windowLinkOpen({ href: makeAbsolutePath(debugLogUrl), title: 'View debug log' })}
								title="Logs"
							>
								<FontAwesomeIcon icon={faTerminal} className="me-2 opacity-70" />
								View logs
							</Popover.Item>
						)}

						<Popover.Item
							onClick={doDelete}
							title="Delete"
							className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 font-medium"
						>
							<FontAwesomeIcon icon={faTrash} className="me-2 text-rose-500" />
							Delete
						</Popover.Item>
					</Popover.Popup>
				</Popover.Root>
			</div>
		</div>
	)
})
