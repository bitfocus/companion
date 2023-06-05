import React, { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CButton, CButtonGroup, CCol, CRow } from '@coreui/react'
import { socketEmitPromise, SocketContext } from './util'
import { nanoid } from 'nanoid'
import dayjs from 'dayjs'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileExport } from '@fortawesome/free-solid-svg-icons'
import { GenericConfirmModal } from './Components/GenericConfirmModal'
import { VariableSizeList as List } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'

export const LogPanel = memo(function LogPanel() {
	const socket = useContext(SocketContext)
	const [config, setConfig] = useState(() => loadConfig())
	const exportRef = useRef()

	// Save the config when it changes
	useEffect(() => {
		window.localStorage.setItem('debug_config', JSON.stringify(config))
	}, [config])

	const doClearLog = useCallback(() => {
		socketEmitPromise(socket, 'logs:clear', []).catch((e) => {
			console.error('Log clear failed', e)
		})
	}, [socket])

	const doToggleConfig = useCallback((key) => {
		setConfig((oldConfig) => ({
			...oldConfig,
			[key]: !oldConfig[key],
		}))
	}, [])

	const doToggleWarn = useCallback(() => doToggleConfig('warn'), [doToggleConfig])
	const doToggleInfo = useCallback(() => doToggleConfig('info'), [doToggleConfig])
	const doToggleDebug = useCallback(() => doToggleConfig('debug'), [doToggleConfig])

	const exportSupportModal = useCallback(() => {
		exportRef.current.show(
			'Export Support Bundle',
			'Are you sure you want to export your configuration and logs?  This may contain sensitive information, such as connection information to online services.  It is not recommended to post this publicly, rather you should send it privately to the necessary party.',
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
								target="_new"
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

function LogPanelContents({ config }) {
	const socket = useContext(SocketContext)

	const [history, setHistory] = useState([])
	const [listChunkClearedToken, setListChunkClearedToken] = useState(nanoid())

	// on 'Mount' setup
	useEffect(() => {
		const getClearLog = () => setHistory([])
		const logRecv = (rawItems) => {
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

		socketEmitPromise(socket, 'logs:subscribe', [])
			.then((lines) => {
				const items = lines.map((item) => ({
					...item,
					id: nanoid(),
				}))

				setHistory(items)
			})
			.catch((e) => {
				console.error('log subscribe error', e)
			})

		socket.on('logs:lines', logRecv)
		socket.on('logs:clear', getClearLog)

		return () => {
			socket.off('logs:lines', logRecv)
			socket.off('logs:clear', getClearLog)

			socketEmitPromise(socket, 'logs:unsubscribe', []).catch((e) => {
				console.error('log unsubscribe error', e)
			})
		}
	}, [socket])
	const listRef = useRef(null)
	const rowHeights = useRef({})

	const [follow, setFollow] = useState(true)

	useEffect(() => {
		// Invalidate everything when the visibility selection changes, or the parent forces a reset
		if (listRef.current) {
			listRef.current.resetAfterIndex(0)
		}
	}, [config, listRef, listChunkClearedToken])

	const messages = useMemo(() => {
		return history.filter((msg) => msg.level === 'error' || config[msg.level])
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
		(event) => {
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
		(index) => {
			return rowHeights.current[index] || 18
		},
		[rowHeights]
	)

	function setRowHeight(index, size) {
		listRef.current.resetAfterIndex(0)
		rowHeights.current = { ...rowHeights.current, [index]: size }
	}

	function Row({ style, index }) {
		const rowRef = useRef({})

		const h = messages[index]

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

	const outerRef = useRef(null)

	return (
		<AutoSizer style={{ width: '100%', height: '100%' }}>
			{({ height, width }) => (
				<List
					height={height}
					itemCount={messages.length}
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

const LogLineInner = memo(({ h, innerRef }) => {
	const time_format = dayjs(h.time).format('YY.MM.DD HH:mm:ss')
	return (
		<div ref={innerRef} className={`log-line log-type-${h.level}`}>
			{time_format} <strong>{h.source}</strong>: <span className="log-message">{h.message}</span>
		</div>
	)
})

function loadConfig() {
	try {
		const rawConfig = window.localStorage.getItem('debug_config')
		return JSON.parse(rawConfig) ?? {}
	} catch (e) {
		// setup defaults
		const config = {
			debug: false,
			info: false,
			warn: true,
		}

		window.localStorage.setItem('debug_config', JSON.stringify(config))

		return config
	}
}
