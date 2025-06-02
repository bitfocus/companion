import React, { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CButton, CButtonGroup, CCol, CRow } from '@coreui/react'
import { SocketContext } from '~/util.js'
import { nanoid } from 'nanoid'
import dayjs from 'dayjs'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileExport } from '@fortawesome/free-solid-svg-icons'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { VariableSizeList as List, ListOnScrollProps } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'
import type { ClientLogLine } from '@companion-app/shared/Model/LogLine.js'

interface LogConfig {
	debug: boolean | undefined
	info: boolean | undefined
	warn: boolean | undefined
}

interface ClientLogLineExt extends Omit<ClientLogLine, 'time'> {
	time: number | null
}

const LogsOnDiskInfoLine: ClientLogLineExt = {
	time: null,
	level: 'debug',
	source: 'log',
	message: 'You can view older logs in the configuration folder',
}

export const LogPanel = memo(function LogPanel() {
	const socket = useContext(SocketContext)
	const [config, setConfig] = useState<LogConfig>(() => loadConfig())
	const exportRef = useRef<GenericConfirmModalRef>(null)

	// Save the config when it changes
	useEffect(() => {
		window.localStorage.setItem('debug_config', JSON.stringify(config))
	}, [config])

	const doClearLog = useCallback(() => {
		socket.emitPromise('logs:clear', []).catch((e) => {
			console.error('Log clear failed', e)
		})
	}, [socket])

	const doToggleConfig = useCallback((key: keyof LogConfig) => {
		setConfig((oldConfig) => ({
			...oldConfig,
			[key]: !oldConfig[key],
		}))
	}, [])

	const doToggleWarn = useCallback(() => doToggleConfig('warn'), [doToggleConfig])
	const doToggleInfo = useCallback(() => doToggleConfig('info'), [doToggleConfig])
	const doToggleDebug = useCallback(() => doToggleConfig('debug'), [doToggleConfig])

	const exportSupportModal = useCallback(() => {
		exportRef.current?.show(
			'Export Support Bundle',
			[
				'This packages up your recent Companion logs, configuration and backups.',
				'This may contain sensitive information, such as connection information to online services.  It is not recommended to post this publicly, rather you should send it privately to a trusted party who is able to help you with an issue.',
			],
			'Export',
			() => {
				window.open('/int/export/support')
			}
		)
	}, [])

	return (
		<>
			<GenericConfirmModal ref={exportRef} />
			<div className="log-page">
				<CRow>
					<CCol lg={12} className="log-buttons">
						<CButtonGroup>
							<CButton color="warning" size="sm" onClick={doToggleWarn} style={{ opacity: config.warn ? 1 : 0.2 }}>
								Warning
							</CButton>
							<CButton color="info" size="sm" onClick={doToggleInfo} style={{ opacity: config.info ? 1 : 0.2 }}>
								Info
							</CButton>
							<CButton color="secondary" size="sm" onClick={doToggleDebug} style={{ opacity: config.debug ? 1 : 0.2 }}>
								Debug
							</CButton>
						</CButtonGroup>

						<div className="float-right">
							<CButton color="danger" size="sm" onClick={doClearLog}>
								Clear log
							</CButton>
							<CButton
								color="light"
								style={{
									marginLeft: 10,
								}}
								size="sm"
								href={`/int/export/log`}
								target="_blank"
							>
								<FontAwesomeIcon icon={faFileExport} /> Export log
							</CButton>
							<CButton
								color="light"
								style={{
									marginLeft: 10,
								}}
								onClick={exportSupportModal}
								size="sm"
							>
								<FontAwesomeIcon icon={faFileExport} /> Export support bundle
							</CButton>
						</div>
					</CCol>
				</CRow>

				<CRow className="log-panel">
					<CCol lg={12} style={{ overflow: 'hidden', height: '100%', width: '100%' }}>
						<LogPanelContents config={config} />
					</CCol>
				</CRow>
			</div>
		</>
	)
})

interface LogPanelContentsProps {
	config: LogConfig
}
function LogPanelContents({ config }: LogPanelContentsProps) {
	const socket = useContext(SocketContext)

	const [history, setHistory] = useState<ClientLogLineExt[]>([])
	const [listChunkClearedToken, setListChunkClearedToken] = useState(nanoid())

	// on 'Mount' setup
	useEffect(() => {
		const getClearLog = () => setHistory([])
		const logRecv = (rawItems: ClientLogLine[]) => {
			if (!rawItems || rawItems.length === 0) return

			const newItems = rawItems.map((item) => ({ ...item, id: nanoid() }))

			setHistory((history) => {
				const newArray = [...history, ...newItems]

				if (newArray.length > 5000) {
					setListChunkClearedToken(nanoid())
					return newArray.slice(-4500)
				} else {
					return newArray
				}
			})
		}

		socket
			.emitPromise('logs:subscribe', [])
			.then((lines: ClientLogLine[]) => {
				const items = lines.map((item) => ({
					...item,
					id: nanoid(),
				}))

				setHistory(items)
			})
			.catch((e) => {
				console.error('log subscribe error', e)
			})

		const unsubLines = socket.on('logs:lines', logRecv)
		const unsubClear = socket.on('logs:clear', getClearLog)

		return () => {
			unsubLines()
			unsubClear()

			socket.emitPromise('logs:unsubscribe', []).catch((e) => {
				console.error('log unsubscribe error', e)
			})
		}
	}, [socket])
	const listRef = useRef<List>(null)
	const rowHeights = useRef<Record<string, number | undefined>>({})

	const [follow, setFollow] = useState(true)

	useEffect(() => {
		// Invalidate everything when the visibility selection changes, or the parent forces a reset
		if (listRef.current) {
			listRef.current.resetAfterIndex(0)
		}
	}, [config, listRef, listChunkClearedToken])

	const messages = useMemo(() => {
		return history.filter((msg) => msg.level === 'error' || !!config[msg.level as keyof LogConfig])
	}, [history, config])

	useEffect(() => {
		if (follow && listRef.current && messages.length > 0) {
			// scroll to bottom
			listRef.current.scrollToItem(messages.length - 1, 'end')
		}
		// eslint-disable-next-line
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
	h: ClientLogLineExt
	innerRef: React.RefObject<HTMLDivElement>
}
const LogLineInner = memo(({ h, innerRef }: LogLineInnerProps) => {
	const time_format = h.time === null ? '                 ' : dayjs(h.time).format('YY.MM.DD HH:mm:ss')
	return (
		<div ref={innerRef} className={`log-line log-type-${h.level}`}>
			{time_format} <strong>{h.source}</strong>: <span className="log-message">{h.message}</span>
		</div>
	)
})

function loadConfig(): LogConfig {
	try {
		const rawConfig = window.localStorage.getItem('debug_config')
		if (!rawConfig) throw new Error()
		const config = JSON.parse(rawConfig)
		if (!config) throw new Error()
		return config
	} catch (e) {
		// setup defaults
		const config: LogConfig = {
			debug: false,
			info: false,
			warn: true,
		}

		window.localStorage.setItem('debug_config', JSON.stringify(config))

		return config
	}
}
