import React, { useCallback, useEffect, useState, memo, useRef, useMemo } from 'react'
import { CButton, CButtonGroup, CCol, CContainer, CRow } from '@coreui/react'
import { nanoid } from 'nanoid'
import { VariableSizeList as List, ListOnScrollProps } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'
import { useResizeObserver } from 'usehooks-ts'
import { stringify as csvStringify } from 'csv-stringify/sync'
import { trpc } from '~/Resources/TRPC'
import { useSubscription } from '@trpc/tanstack-react-query'
import { TRPCConnectionStatus, useTRPCConnectionStatus } from '~/Hooks/useTRPCConnectionStatus'

interface DebugLogLine {
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
						{ level: 'system', message: `Log subscription failed: ${err.message}` },
					])
				},
			}
		)
	)

	const [listChunkClearedToken, setListChunkClearedToken] = useState(nanoid())

	const doClearLog = useCallback(() => {
		setLinesBuffer([{ level: 'system', message: '** Log cleared **' }])
		setListChunkClearedToken(nanoid())
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

	const contentRef = useRef(null)
	const { width: contentWidth } = useResizeObserver({ ref: contentRef })

	return (
		<CContainer style={{ height: 'calc(100vh - 10px)', padding: '10px', background: '#eee' }}>
			<div className="log-page">
				<CRow className="log-debug-buttons">
					<CCol>
						<CButtonGroup>
							<CButton color={isConnected ? 'success' : 'warning'} size="sm" disabled>
								{isConnected ? 'Connected' : 'Reconnecting'}
							</CButton>
						</CButtonGroup>

						<CButtonGroup>
							<CButton color="danger" size="sm" onClick={doClearLog}>
								Clear log
							</CButton>
							<CButton color="info" size="sm" onClick={doExportLog}>
								Export log
							</CButton>
						</CButtonGroup>

						<CButtonGroup>
							<CButton color="danger" size="sm" onClick={doStopInstance}>
								Stop {instanceTypeStr}
							</CButton>
							<CButton color="success" size="sm" onClick={doStartInstance}>
								Start {instanceTypeStr}
							</CButton>
						</CButtonGroup>

						<div className="float-right">
							<CButtonGroup>
								<CButton color="danger" size="sm" onClick={doToggleError} style={{ opacity: config.error ? 1 : 0.2 }}>
									Error
								</CButton>
								<CButton color="warning" size="sm" onClick={doToggleWarn} style={{ opacity: config.warn ? 1 : 0.2 }}>
									Warning
								</CButton>
								<CButton color="info" size="sm" onClick={doToggleInfo} style={{ opacity: config.info ? 1 : 0.2 }}>
									Info
								</CButton>
								<CButton
									color="secondary"
									size="sm"
									onClick={doToggleDebug}
									style={{ opacity: config.debug ? 1 : 0.2 }}
								>
									Debug
								</CButton>
								<CButton
									color="secondary"
									size="sm"
									onClick={doToggleConsole}
									style={{ opacity: config.console ? 1 : 0.2 }}
								>
									Console
								</CButton>
							</CButtonGroup>
						</div>
					</CCol>
				</CRow>
				<CRow ref={contentRef} className="log-panel">
					<CCol lg={12} style={{ overflow: 'hidden', height: '100%', width: '100%' }}>
						<LogPanelContents
							linesBuffer={linesBuffer}
							listChunkClearedToken={listChunkClearedToken}
							config={config}
							contentWidth={contentWidth ?? 0}
						/>
					</CCol>
				</CRow>
			</div>
		</CContainer>
	)
}

interface LogPanelContentsProps {
	linesBuffer: DebugLogLine[]
	listChunkClearedToken: string
	config: DebugConfig
	contentWidth: number
}

function LogPanelContents({ linesBuffer, listChunkClearedToken, config, contentWidth }: LogPanelContentsProps) {
	const listRef = useRef<List>(null)
	const rowHeights = useRef<Record<string, number | undefined>>({})

	const [follow, setFollow] = useState(true)

	useEffect(() => {
		// Invalidate everything when the visibility selection changes, or the parent forces a reset
		if (listRef.current) {
			listRef.current.resetAfterIndex(0)
		}
	}, [listRef, listChunkClearedToken, contentWidth])

	const messages = useMemo(() => {
		return linesBuffer.filter((msg) => msg.level === 'system' || !!config[msg.level as keyof DebugConfig])
	}, [linesBuffer, config])

	useEffect(() => {
		if (follow && listRef.current && messages.length > 0) {
			// scroll to bottom
			listRef.current.scrollToItem(messages.length - 1, 'end')
		}
	}, [messages, follow])

	const hasMountedRef = useRef(false)
	const userScroll = useCallback(
		(event: ListOnScrollProps) => {
			// Ignore scroll event on mount
			if (!hasMountedRef.current) {
				hasMountedRef.current = true

				setTimeout(() => {
					if (listRef.current && messages.length > 0) {
						// scroll to bottom
						listRef.current.scrollToItem(messages.length - 1, 'end')
					}
				}, 100)
				return
			}

			// if it was the user, then disable following
			if (event.scrollUpdateWasRequested === false) {
				setFollow(false)
			}

			if (!outerRef.current) {
				return
			}

			// if scrolling is at the bottom, reenable following
			if (event.scrollOffset + outerRef.current.offsetHeight === outerRef.current.scrollHeight) {
				setFollow(true)
			}
		},
		[messages.length]
	)

	const getRowHeight = useCallback(
		(index: number) => {
			return rowHeights.current[index] || 18
		},
		[rowHeights]
	)

	function setRowHeight(index: number, size: number) {
		if (listRef.current) {
			listRef.current.resetAfterIndex(0)
		}
		rowHeights.current = { ...rowHeights.current, [index]: size }
	}

	function Row({ style, index }: { style: React.CSSProperties; index: number }) {
		const rowRef = useRef<HTMLDivElement>(null)

		const h = index === 0 ? LogsOnDiskInfoLine : messages[index - 1]

		useEffect(() => {
			if (rowRef.current) {
				setRowHeight(index, rowRef.current.clientHeight)
			}
			// eslint-disable-next-line
		}, [rowRef])

		return (
			<div style={style}>
				<LogLineInner h={h} innerRef={rowRef} />
			</div>
		)
	}

	const outerRef = useRef<HTMLElement>(null)

	return (
		<AutoSizer style={{ width: '100%', height: '100%' }}>
			{({ height, width }) => (
				<List
					height={height}
					itemCount={messages.length + 1}
					onScroll={userScroll}
					itemSize={getRowHeight}
					ref={listRef}
					outerRef={outerRef}
					width={width}
				>
					{Row}
				</List>
			)}
		</AutoSizer>
	)
}

interface LogLineInnerProps {
	h: DebugLogLine
	innerRef: React.RefObject<HTMLDivElement>
}
const LogLineInner = memo(({ h, innerRef }: LogLineInnerProps) => {
	return (
		<div ref={innerRef} className={`log-line log-type-${h.level}`}>
			{h.level !== 'console' && (
				<>
					<strong>{h.level}</strong>:{' '}
				</>
			)}
			<span className="log-message">{h.message}</span>
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
