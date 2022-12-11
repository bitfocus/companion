import { useCallback, useEffect, useState, useContext, memo, useRef } from 'react'
import { SocketContext, socketEmitPromise } from './util'
import { CButton, CButtonGroup, CCol, CContainer, CRow } from '@coreui/react'
import { nanoid } from 'nanoid'
import { useParams } from 'react-router-dom'
import { VariableSizeList as List } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'

export function ConnectionDebug() {
	const socket = useContext(SocketContext)

	const { id: connectionId } = useParams()

	// const [loadError, setLoadError]=useState(null)
	const [linesBuffer, setLinesBuffer] = useState([])

	const [isConnected, setIsConnected] = useState(false)
	useEffect(() => {
		const onConnected = () => {
			setIsConnected(true)
		}
		const onDisconnected = () => {
			setIsConnected(false)
		}

		socket.on('connect', onConnected)
		socket.on('disconnect', onDisconnected)

		if (socket.connected) onConnected()

		return () => {
			socket.off('connect', onConnected)
			socket.off('disconnect', onDisconnected)
		}
	}, [socket])

	useEffect(() => {
		setLinesBuffer([])

		const onNewLines = (level, message) => {
			setLinesBuffer((oldLines) => [...oldLines, { level, message }])
		}

		socket.on(`connection-debug:update:${connectionId}`, onNewLines)

		socketEmitPromise(socket, 'connection-debug:subscribe', [connectionId])
			.then((info) => {
				// TODO
				console.log('subscried', info)
			})
			.catch((err) => {
				//TODO
				console.error('Subscribe failure', err)
			})

		return () => {
			socket.emit('connection-debug:unsubscribe')
			socket.off(`connection-debug:update:${connectionId}`, onNewLines)
		}
	}, [socket, connectionId])

	const [listChunkClearedToken, setListChunkClearedToken] = useState(nanoid())

	const doClearLog = useCallback(() => {
		setLinesBuffer([{ level: 'system', message: '** Log cleared **' }])
		setListChunkClearedToken(nanoid())
	}, [])

	const doStopConnection = useCallback(() => {
		socketEmitPromise(socket, 'instances:set-enabled', [connectionId, false]).catch((e) => {
			console.error('Failed', e)
		})
	}, [socket, connectionId])
	const doStartConnection = useCallback(() => {
		socketEmitPromise(socket, 'instances:set-enabled', [connectionId, true]).catch((e) => {
			console.error('Failed', e)
		})
	}, [socket, connectionId])

	return (
		<CContainer style={{ height: 'calc(100vh - 10px)', padding: '10px', background: '#eee' }}>
			<div className="log-page">
				<CRow className="log-debug-buttons">
					<CButtonGroup>
						<CButton color={isConnected ? 'success' : 'warning'} size="sm" disabled>
							{isConnected ? 'Connected' : 'Reconnecting'}
						</CButton>
					</CButtonGroup>

					<CButtonGroup>
						<CButton color="danger" size="sm" onClick={doClearLog}>
							Clear log
						</CButton>
					</CButtonGroup>

					<CButtonGroup>
						<CButton color="danger" size="sm" onClick={doStopConnection}>
							Stop connection
						</CButton>
						<CButton color="success" size="sm" onClick={doStartConnection}>
							Start connection
						</CButton>
					</CButtonGroup>
				</CRow>
				<CRow className="log-panel">
					<CCol lg={12} style={{ overflow: 'hidden', height: '100%', width: '100%' }}>
						<LogPanelContents linesBuffer={linesBuffer} listChunkClearedToken={listChunkClearedToken} />
					</CCol>
				</CRow>
			</div>
		</CContainer>
	)
}

function LogPanelContents({ linesBuffer, listChunkClearedToken }) {
	const listRef = useRef(null)
	const rowHeights = useRef({})

	const [follow, setFollow] = useState(true)

	useEffect(() => {
		// Invalidate everything when the visibility selection changes, or the parent forces a reset
		if (listRef.current) {
			listRef.current.resetAfterIndex(0)
		}
	}, [listRef, listChunkClearedToken])

	const messages = linesBuffer
	// const messages = useMemo(() => {
	// 	return history.filter((msg) => msg.level === 'error' || config[msg.level])
	// }, [history, config])

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
	return (
		<div ref={innerRef} className={`log-line log-type-${h.level}`}>
			<strong>{h.level}</strong>: <span className="log-message">{h.message}</span>
		</div>
	)
})
