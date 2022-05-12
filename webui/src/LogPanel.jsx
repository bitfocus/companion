import React, { memo, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CButton, CButtonGroup, CCol, CRow } from '@coreui/react'
import { socketEmit, StaticContext } from './util'
import { nanoid } from 'nanoid'
import dayjs from 'dayjs'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileExport } from '@fortawesome/free-solid-svg-icons'
import { GenericConfirmModal } from './Components/GenericConfirmModal'

export const LogPanel = memo(function LogPanel() {
	const context = useContext(StaticContext)
	const [config, setConfig] = useState(() => loadConfig())
	const [history, setHistory] = useState([])
	const exportRef = useRef()

	// on 'Mount' setup
	useEffect(() => {
		const getClearLog = () => setHistory([])
		const logRecv = (time, source, level, message) => {
			const item = {
				id: nanoid(),
				time,
				source,
				level,
				message,
			}

			setHistory((history) => [item, ...history].slice(0, 500))
		}

		socketEmit(context.socket, 'log_catchup', [])
			.then(([lines]) => {
				const items = lines.map(([time, source, level, message]) => ({
					id: nanoid(),
					time,
					source,
					level,
					message,
				}))

				setHistory(items.reverse())
			})
			.catch((e) => {
				console.error('log catchup error', e)
			})

		// context.socket.emit('log_catchup')
		context.socket.on('log', logRecv)
		context.socket.on('log_clear', getClearLog)

		return () => {
			context.socket.off('log', logRecv)
			context.socket.off('log_clear', getClearLog)
		}
	}, [context.socket])

	// Save the config when it changes
	useEffect(() => {
		window.localStorage.setItem('debug_config', JSON.stringify(config))
	}, [config])

	const doClearLog = useCallback(() => {
		context.socket.emit('log_clear')
		setHistory([])
	}, [context.socket])

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
				window.open('/int/support_export')
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
							<CButton color="danger" size="sm" onClick={doClearLog} style={{ opacity: history.length > 0 ? 1 : 0.2 }}>
								Clear log
							</CButton>
							<CButton
								color="light"
								style={{
									marginLeft: 10,
								}}
								size="sm"
								href={`/int/log_export`}
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
					<CCol lg={12}>
						{history.map((h) => {
							if (h.level === 'error' || config[h.level]) {
								const time_format = dayjs(h.time).format('YY.MM.DD HH:mm:ss')
								return (
									<div key={h.id} className={`log-line log-type-${h.level}`}>
										{time_format} <strong>{h.source}</strong>: <span className="log-message">{h.message}</span>
									</div>
								)
							} else {
								return ''
							}
						})}
					</CCol>
				</CRow>
			</div>
		</>
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
