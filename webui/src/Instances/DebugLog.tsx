import { faBug } from '@fortawesome/free-solid-svg-icons'
import { useSubscription } from '@trpc/tanstack-react-query'
import { stringify as csvStringify } from 'csv-stringify/browser/esm/sync'
import {
	AlertCircle,
	AlertTriangle,
	Bug,
	FileDown,
	Info,
	Play,
	Search,
	Square,
	Terminal,
	Trash2,
	X,
} from 'lucide-react'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'
import { LogLine, LogNoticeLine, VirtualLogList } from '~/Components/LogViewer.js'
import { PillButton, type PillTone } from '~/Components/PillButton.js'
import { safeSetLocalStorage } from '~/Helpers/SafeStorage.js'
import { InstanceTableStatusCell } from '~/Instances/List/InstanceTableStatusCell.js'
import { PageHeader } from '~/Layout/PageHeader.js'
import { trpc } from '~/Resources/TRPC'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface DebugLogLine {
	time: number | null
	source: string | null
	level: string
	message: string
}

interface DebugConfig {
	debug: boolean | undefined
	info: boolean | undefined
	warn: boolean | undefined
	error: boolean | undefined
	console: boolean | undefined
}

const DEBUG_LEVELS = [
	{ key: 'error', label: 'Error', icon: AlertCircle, tone: 'error' },
	{ key: 'warn', label: 'Warn', icon: AlertTriangle, tone: 'warning' },
	{ key: 'info', label: 'Info', icon: Info, tone: 'info' },
	{ key: 'debug', label: 'Debug', icon: Bug, tone: 'neutral' },
	{ key: 'console', label: 'Console', icon: Terminal, tone: 'media' },
] as const satisfies readonly { key: keyof DebugConfig; label: string; icon: typeof Info; tone: PillTone }[]

const LogsOnDiskInfoLine: DebugLogLine = {
	time: null,
	source: 'System',
	level: 'system',
	message: 'Starting log. Only lines generated since opening the page are shown here',
}

export interface InstanceDebugLogProps {
	instanceId: string
	instanceTypeStr: string
	setEnabled: (enabled: boolean) => void
}

export const InstanceDebugLog = observer(function InstanceDebugLog({
	instanceId,
	instanceTypeStr,
	setEnabled,
}: InstanceDebugLogProps): React.JSX.Element {
	const rootAppStore = useContext(RootAppStoreContext)
	const [connectionInfo, setConnectionInfo] = useState<ClientConnectionConfig | null>(null)
	const [connectionStatus, setConnectionStatus] = useState<InstanceStatusEntry | null>(null)
	const [searchQuery, setSearchQuery] = useState('')

	useSubscription(
		trpc.instances.connections.watch.subscriptionOptions(undefined, {
			enabled: instanceTypeStr === 'connection',
			onData: (changes) => {
				for (const change of changes) {
					if (change.type === 'init') {
						if (change.info[instanceId]) {
							setConnectionInfo(change.info[instanceId])
						}
					} else if (change.type === 'update') {
						if (change.id === instanceId) {
							setConnectionInfo(change.info)
						}
					} else if (change.type === 'remove') {
						if (change.id === instanceId) {
							setConnectionInfo(null)
						}
					}
				}
			},
		})
	)

	useSubscription(
		trpc.instances.surfaces.watch.subscriptionOptions(undefined, {
			enabled: instanceTypeStr !== 'connection',
			onData: (changes) => {
				for (const change of changes) {
					if (change.type === 'init') {
						if (change.info[instanceId]) {
							setConnectionInfo(change.info[instanceId] as unknown as ClientConnectionConfig)
						}
					} else if (change.type === 'update') {
						if (change.id === instanceId) {
							setConnectionInfo(change.info as unknown as ClientConnectionConfig)
						}
					} else if (change.type === 'remove') {
						if (change.id === instanceId) {
							setConnectionInfo(null)
						}
					}
				}
			},
		})
	)

	useSubscription(
		trpc.instances.statuses.watch.subscriptionOptions(undefined, {
			onData: (data) => {
				if (!data) return
				if (data.type === 'init') {
					if (data.statuses[instanceId]) {
						setConnectionStatus(data.statuses[instanceId])
					}
				} else if (data.type === 'update') {
					if (data.instanceId === instanceId) {
						setConnectionStatus(data.status)
					}
				} else if (data.type === 'remove') {
					if (data.instanceId === instanceId) {
						setConnectionStatus(null)
					}
				}
			},
		})
	)

	const isEnabled = connectionInfo ? connectionInfo.enabled !== false : true
	const label = connectionInfo?.label ?? rootAppStore?.connections?.getInfo(instanceId)?.label ?? instanceId

	// const [loadError, setLoadError]=useState(null)
	const [linesBuffer, setLinesBuffer] = useState<DebugLogLine[]>([])

	useSubscription(
		trpc.instances.debugLog.subscriptionOptions(
			{
				instanceId: instanceId,
			},
			{
				enabled: !!instanceId,
				onStarted: () => {
					setLinesBuffer([])
					console.log('Subscribed to connection debug log', instanceId)
				},
				onData: (data) => {
					setLinesBuffer((oldLines) => [...oldLines, data])
				},
				onError: (err) => {
					console.error('Error in connection debug log subscription', err)
					setLinesBuffer((oldLines) => [
						...oldLines,
						{ time: null, source: 'System', level: 'system', message: `Log subscription failed: ${err.message}` },
					])
				},
			}
		)
	)

	const doClearLog = useCallback(() => {
		setLinesBuffer([{ time: null, source: 'System', level: 'system', message: '** Log cleared **' }])
	}, [])

	const doExportLog = useCallback(() => {
		const csv = csvStringify([
			['Date', 'Type', 'Source', 'Log'],
			...linesBuffer.map((line) => [
				line.time ? new Date(line.time).toISOString() : '',
				line.level,
				line.source ?? '',
				line.message,
			]),
		])

		const blob = new Blob([csv], { type: 'text/csv' })
		const link = document.createElement('a')
		link.setAttribute(
			'download',
			`module-log-${new Date().toLocaleDateString()}-${new Date().toLocaleTimeString()}.csv`
		)
		// @ts-expect-error `oneTimeOnly` not defined in typings
		link.href = window.URL.createObjectURL(blob, { oneTimeOnly: true })
		document.body.appendChild(link)
		link.click()
		link.remove()
	}, [linesBuffer])

	const doToggleInstance = useCallback(() => setEnabled(!isEnabled), [isEnabled, setEnabled])

	const [config, setConfig] = useState<DebugConfig>(() => loadConfig(instanceId ?? ''))
	// Save the config when it changes
	useEffect(() => {
		safeSetLocalStorage(`module_debug:${instanceId}`, JSON.stringify(config))
	}, [config, instanceId])

	const doToggleConfig = useCallback((key: keyof DebugConfig) => {
		setConfig((oldConfig) => ({
			...oldConfig,
			[key]: !oldConfig[key],
		}))
	}, [])
	const counts = useMemo(() => {
		const result = { error: 0, warn: 0, info: 0, debug: 0, console: 0 }
		for (const line of linesBuffer) {
			if (line.level in result) result[line.level as keyof DebugConfig]++
		}
		return result
	}, [linesBuffer])

	return (
		<div className="page-shell bg-app-frame-bg h-screen max-h-screen text-body pt-3">
			<PageHeader icon={faBug} title={`Debug Log: ${label}`} helpAction="/user-guide/config/connections" />

			{/* Top Controls Bar */}
			<div className="bg-surface-muted/60 border border-border/80 p-3 rounded-xl flex flex-col gap-3 shrink-0 shadow-xs">
				<div className="flex items-center justify-between gap-3 flex-wrap">
					<div className="flex items-center gap-1.5 flex-wrap">
						<span className="text-xs font-semibold text-body me-1">Filters:</span>
						{DEBUG_LEVELS.map(({ key, label: levelLabel, icon: Icon, tone }) => (
							<PillButton key={key} small tone={tone} active={!!config[key]} onClick={() => doToggleConfig(key)}>
								<Icon className="w-3.5 h-3.5" />
								<span>
									{levelLabel} ({counts[key]})
								</span>
							</PillButton>
						))}
					</div>

					<div className="flex items-center gap-2 flex-wrap">
						<InstanceTableStatusCell isEnabled={isEnabled} status={connectionStatus ?? undefined} />
						<PillButton
							tone="primary"
							active={false}
							onClick={doClearLog}
							title="Clear log history"
							className="hover:text-rose-500"
						>
							<Trash2 className="w-3.5 h-3.5" />
							<span>Clear</span>
						</PillButton>
						<PillButton tone="primary" active={false} onClick={doExportLog} title="Download log file">
							<FileDown className="w-3.5 h-3.5" />
							<span>Export Log</span>
						</PillButton>
						<PillButton tone={isEnabled ? 'error' : 'good'} active onClick={doToggleInstance}>
							{isEnabled ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
							<span>
								{isEnabled ? 'Stop' : 'Start'} {instanceTypeStr}
							</span>
						</PillButton>
					</div>
				</div>

				<div className="relative flex items-center">
					<Search className="w-4 h-4 absolute left-3 text-muted pointer-events-none" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search logs by keyword, source, or message..."
						className="w-full bg-surface border border-border rounded-lg pl-9 pr-8 py-1.5 text-xs text-body placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
					/>
					{searchQuery && (
						<button
							type="button"
							onClick={() => setSearchQuery('')}
							className="absolute right-2.5 text-muted hover:text-body p-0.5"
							title="Clear search"
						>
							<X className="w-3.5 h-3.5" />
						</button>
					)}
				</div>
			</div>

			{/* Log Content Terminal Window */}
			<div className="flex-1 min-h-0 bg-surface rounded-xl border border-border/80 shadow-xs overflow-hidden flex flex-col p-2">
				<LogPanelContents linesBuffer={linesBuffer} config={config} searchQuery={searchQuery} />
			</div>
		</div>
	)
})

interface LogPanelContentsProps {
	linesBuffer: DebugLogLine[]
	config: DebugConfig
	searchQuery: string
}

function LogPanelContents({ linesBuffer, config, searchQuery }: LogPanelContentsProps) {
	const messages = useMemo(() => {
		const query = searchQuery.toLowerCase()
		return linesBuffer.filter((msg) => {
			if (msg.level !== 'system' && !config[msg.level as keyof DebugConfig]) return false
			return !query || [msg.message, msg.source, msg.level].some((value) => value?.toLowerCase().includes(query))
		})
	}, [linesBuffer, config, searchQuery])

	return (
		<VirtualLogList
			lines={messages}
			header={<LogNoticeLine message={LogsOnDiskInfoLine.message} />}
			renderLine={(line) => (
				<LogLine
					line={line}
					timeFormat="HH:mm:ss.SSS"
					timeClassName=""
					sourceClassName="log-source-cell text-2xs pt-0.5"
					alwaysReserveSource={false}
				/>
			)}
			estimateSize={28}
			autoScroll
			className="w-full h-full overflow-auto font-mono text-xs select-text scrollbar-thin"
		/>
	)
}

function loadConfig(instanceId: string): DebugConfig {
	const saveId = `module_debug:${instanceId}`
	try {
		const rawConfig = window.localStorage.getItem(saveId)
		if (!rawConfig) throw new Error()
		const config = JSON.parse(rawConfig)
		if (!config) throw new Error()
		return config
	} catch (_e) {
		// setup defaults
		const config: DebugConfig = {
			debug: true,
			info: true,
			warn: true,
			error: true,
			console: true,
		}

		safeSetLocalStorage(saveId, JSON.stringify(config))

		return config
	}
}
