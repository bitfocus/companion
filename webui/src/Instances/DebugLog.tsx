import { CCol, CContainer, CRow } from '@coreui/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useSubscription } from '@trpc/tanstack-react-query'
import { stringify as csvStringify } from 'csv-stringify/browser/esm/sync'
import dayjs from 'dayjs'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, ButtonGroup } from '~/Components/Button'
import { useStickyScroll } from '~/Hooks/useStickyScroll.js'
import { TRPCConnectionStatus, useTRPCConnectionStatus } from '~/Hooks/useTRPCConnectionStatus'
import { trpc } from '~/Resources/TRPC'

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

export function InstanceDebugLog({
	instanceId,
	instanceTypeStr,
	setEnabled,
}: InstanceDebugLogProps): React.JSX.Element {
	const trpcStatus = useTRPCConnectionStatus()

	// const [loadError, setLoadError]=useState(null)
	const [linesBuffer, setLinesBuffer] = useState<DebugLogLine[]>([])

	const [isConnected, setIsConnected] = useState(false)
	useEffect(() => {
		if (trpcStatus.status === TRPCConnectionStatus.Connected) {
			setIsConnected(true)
			setLinesBuffer([])
		} else {
			setIsConnected(false)
		}
	}, [trpcStatus.status])

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
		const csv = csvStringify(linesBuffer.map((line) => [line.level, line.message]))

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

	const doStopInstance = useCallback(() => setEnabled(false), [setEnabled])
	const doStartInstance = useCallback(() => setEnabled(true), [setEnabled])

	const [config, setConfig] = useState<DebugConfig>(() => loadConfig(instanceId ?? ''))
	// Save the config when it changes
	useEffect(() => {
		window.localStorage.setItem(`module_debug:${instanceId}`, JSON.stringify(config))
	}, [config, instanceId])

	const doToggleConfig = useCallback((key: keyof DebugConfig) => {
		setConfig((oldConfig) => ({
			...oldConfig,
			[key]: !oldConfig[key],
		}))
	}, [])

	const doToggleError = useCallback(() => doToggleConfig('error'), [doToggleConfig])
	const doToggleWarn = useCallback(() => doToggleConfig('warn'), [doToggleConfig])
	const doToggleInfo = useCallback(() => doToggleConfig('info'), [doToggleConfig])
	const doToggleDebug = useCallback(() => doToggleConfig('debug'), [doToggleConfig])
	const doToggleConsole = useCallback(() => doToggleConfig('console'), [doToggleConfig])

	return (
		<CContainer style={{ height: 'calc(100vh - 10px)', padding: '10px', background: '#eee' }}>
			<div className="log-page">
				<CRow className="log-debug-buttons">
					<CCol>
						<ButtonGroup>
							<Button color={isConnected ? 'success' : 'warning'} size="sm" disabled>
								{isConnected ? 'Connected' : 'Reconnecting'}
							</Button>
						</ButtonGroup>

						<ButtonGroup>
							<Button color="danger" size="sm" onClick={doClearLog}>
								Clear log
							</Button>
							<Button color="info" size="sm" onClick={doExportLog}>
								Export log
							</Button>
						</ButtonGroup>

						<ButtonGroup>
							<Button color="danger" size="sm" onClick={doStopInstance}>
								Stop {instanceTypeStr}
							</Button>
							<Button color="success" size="sm" onClick={doStartInstance}>
								Start {instanceTypeStr}
							</Button>
						</ButtonGroup>

						<div className="float-right">
							<ButtonGroup>
								<Button color="danger" size="sm" onClick={doToggleError} style={{ opacity: config.error ? 1 : 0.2 }}>
									Error
								</Button>
								<Button color="warning" size="sm" onClick={doToggleWarn} style={{ opacity: config.warn ? 1 : 0.2 }}>
									Warning
								</Button>
								<Button color="info" size="sm" onClick={doToggleInfo} style={{ opacity: config.info ? 1 : 0.2 }}>
									Info
								</Button>
								<Button color="secondary" size="sm" onClick={doToggleDebug} style={{ opacity: config.debug ? 1 : 0.2 }}>
									Debug
								</Button>
								<Button
									color="secondary"
									size="sm"
									onClick={doToggleConsole}
									style={{ opacity: config.console ? 1 : 0.2 }}
								>
									Console
								</Button>
							</ButtonGroup>
						</div>
					</CCol>
				</CRow>
				<CRow className="log-panel">
					<CCol lg={12} style={{ overflow: 'hidden', height: '100%', width: '100%' }}>
						<LogPanelContents linesBuffer={linesBuffer} config={config} />
					</CCol>
				</CRow>
			</div>
		</CContainer>
	)
}

interface LogPanelContentsProps {
	linesBuffer: DebugLogLine[]
	config: DebugConfig
}

function LogPanelContents({ linesBuffer, config }: LogPanelContentsProps) {
	const parentRef = useRef<HTMLDivElement>(null)

	const messages = useMemo(() => {
		return linesBuffer.filter((msg) => msg.level === 'system' || !!config[msg.level as keyof DebugConfig])
	}, [linesBuffer, config])

	const count = messages.length + 1

	// eslint-disable-next-line react-hooks/incompatible-library
	const virtualizer = useVirtualizer({
		count: count,
		getScrollElement: () => parentRef.current,
		estimateSize: () => 18,
		overscan: 5,
	})

	const onScroll = useStickyScroll(parentRef, virtualizer, count)

	const items = virtualizer.getVirtualItems()

	return (
		<div ref={parentRef} style={{ width: '100%', height: '100%', overflow: 'auto' }} onScroll={onScroll}>
			<div
				style={{
					height: virtualizer.getTotalSize(),
					width: '100%',
					position: 'relative',
				}}
			>
				<div
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						width: '100%',
						transform: `translateY(${items[0]?.start ?? 0}px)`,
					}}
				>
					{items.map((virtualRow) => (
						<div
							key={virtualRow.key}
							data-index={virtualRow.index}
							ref={virtualizer.measureElement}
							className={virtualRow.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
						>
							<LogLineInner line={virtualRow.index === 0 ? LogsOnDiskInfoLine : messages[virtualRow.index - 1]} />
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

interface LogLineInnerProps {
	line: DebugLogLine
}
const LogLineInner = memo(({ line }: LogLineInnerProps) => {
	const time_format = !line.time ? '                 ' : dayjs(line.time).format('YY.MM.DD HH:mm:ss')

	return (
		<div className={`log-line log-type-${line.level}`}>
			{time_format} <strong>{line.source}</strong>: <span className="log-message">{line.message}</span>
		</div>
	)
})

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

		window.localStorage.setItem(saveId, JSON.stringify(config))

		return config
	}
}
