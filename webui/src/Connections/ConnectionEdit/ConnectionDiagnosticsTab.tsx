import { faArrowUpRightFromSquare, faBug } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSubscription } from '@trpc/tanstack-react-query'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useState } from 'react'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'
import type { ClientModuleInfo, ClientModuleVersionInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { Badge } from '~/Components/Badge.js'
import { Button, LinkButtonExternal } from '~/Components/Button.js'
import { EditSectionCard } from '~/Components/EditSectionCard.js'
import { LogLine, LogNoticeLine, VirtualLogList, type LogViewerLine } from '~/Components/LogViewer.js'
import { windowLinkOpen } from '~/Helpers/Window.js'
import { InstanceTableStatusCell } from '~/Instances/List/InstanceTableStatusCell.js'
import { UpdateInstanceToLatestBadge } from '~/Instances/UpdateInstanceToLatestBadge.js'
import { trpc } from '~/Resources/TRPC.js'
import { makeAbsolutePath } from '~/Resources/util.js'

/** Enough to see what led up to a problem, without the tab holding an unbounded buffer. */
const MAX_RECENT_LOG_LINES = 200

interface ConnectionDiagnosticsTabProps {
	connectionInfo: ClientConnectionConfig
	status: InstanceStatusEntry | undefined
	moduleInfo: ClientModuleInfo | undefined
	moduleVersion: ClientModuleVersionInfo | null | undefined
}

export const ConnectionDiagnosticsTab = observer(function ConnectionDiagnosticsTab({
	connectionInfo,
	status,
	moduleInfo,
	moduleVersion,
}: ConnectionDiagnosticsTabProps) {
	const statusMessage =
		status?.message === null || status?.message === undefined
			? null
			: typeof status.message === 'string'
				? status.message
				: JSON.stringify(status.message, null, 2)

	const bugUrl = moduleInfo?.display?.bugUrl

	return (
		<div className="page-scroll edit-panel edit-panel-scroll">
			<EditSectionCard title="Health">
				<div className="edit-field-row">
					<span className="text-xs font-semibold text-body">Status</span>
					<div>
						<InstanceTableStatusCell isEnabled={connectionInfo.enabled !== false} status={status} />
					</div>
				</div>
				<div className="edit-field-row">
					<span className="text-xs font-semibold text-body">Message</span>
					<div className={classNames('connection-diagnostics-message', !statusMessage && 'text-muted')}>
						{statusMessage || 'No message'}
					</div>
				</div>
			</EditSectionCard>

			<EditSectionCard title="Recent Log">
				<ConnectionRecentLog connectionId={connectionInfo.id} />
			</EditSectionCard>

			<EditSectionCard title="Module Info">
				<DiagnosticsRow label="Module">{moduleInfo?.display?.name ?? connectionInfo.moduleId}</DiagnosticsRow>
				<DiagnosticsRow label="Module ID">
					<span className="font-mono select-all">{connectionInfo.moduleId}</span>
				</DiagnosticsRow>
				<DiagnosticsRow label="Version">
					<span className="inline-flex items-center gap-2">
						<span className="font-mono">{moduleVersion?.displayName ?? connectionInfo.moduleVersionId}</span>
						{connectionInfo.moduleVersionId === 'dev' && <Badge tone="info">Dev build</Badge>}
						{moduleVersion?.isBeta && <Badge tone="warning">Beta</Badge>}
						{moduleVersion?.isLegacy && (
							<Badge tone="warning" title="This module has not been updated for Companion 3.0, and may not work fully">
								Legacy
							</Badge>
						)}
						<UpdateInstanceToLatestBadge instance={connectionInfo} />
					</span>
				</DiagnosticsRow>
				<DiagnosticsRow label="Connection ID">
					<span className="font-mono select-all">{connectionInfo.id}</span>
				</DiagnosticsRow>
				{!!bugUrl && (
					<DiagnosticsRow label="Issues">
						<LinkButtonExternal href={bugUrl} variant="ghost" size="sm" color="primary">
							<FontAwesomeIcon icon={faBug} className="me-1.5" />
							Report or browse known issues
						</LinkButtonExternal>
					</DiagnosticsRow>
				)}
			</EditSectionCard>
		</div>
	)
})

function DiagnosticsRow({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="edit-field-row">
			<span className="text-xs font-semibold text-body">{label}</span>
			<div className="text-xs text-body min-w-0">{children}</div>
		</div>
	)
}

function ConnectionRecentLog({ connectionId }: { connectionId: string }) {
	const [lines, setLines] = useState<LogViewerLine[]>([])

	useSubscription(
		trpc.instances.debugLog.subscriptionOptions(
			{ instanceId: connectionId },
			{
				onStarted: () => setLines([]),
				onData: (data) => setLines((old) => [...old, data].slice(-MAX_RECENT_LOG_LINES)),
				onError: (err) => {
					console.error('Error in connection debug log subscription', err)
					setLines((old) => [
						...old,
						{ time: null, source: 'System', level: 'system', message: `Log subscription failed: ${err.message}` },
					])
				},
			}
		)
	)

	const openFullLog = useCallback(
		() => windowLinkOpen({ href: makeAbsolutePath(`/connection-debug/${connectionId}`), title: 'View debug log' }),
		[connectionId]
	)

	return (
		<>
			<div className="connection-diagnostics-log">
				<VirtualLogList
					lines={lines}
					header={<LogNoticeLine message="Only lines generated since opening this tab are shown here" />}
					renderLine={(line) => (
						<LogLine
							line={line}
							timeFormat="HH:mm:ss"
							timeClassName=""
							sourceClassName="log-source-cell text-2xs pt-0.5"
							alwaysReserveSource={false}
						/>
					)}
					estimateSize={28}
					autoScroll
					className="w-full h-full overflow-auto font-mono text-xs select-text scrollbar-thin"
				/>
			</div>
			<div className="flex justify-end">
				<Button variant="ghost" size="sm" color="primary" onClick={openFullLog}>
					<FontAwesomeIcon icon={faArrowUpRightFromSquare} className="me-1.5" />
					Open full log
				</Button>
			</div>
		</>
	)
}
