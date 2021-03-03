import React, { memo, useCallback, useContext, useEffect, useState } from 'react'
import { CButton, CButtonGroup, CCol, CRow } from '@coreui/react'
import { CompanionContext } from './util'
import shortid from 'shortid'
import dayjs from 'dayjs'

export const LogPanel = memo(function LogPanel() {
	const context = useContext(CompanionContext)
	const [config, setConfig] = useState(() => loadConfig())
	const [history, setHistory] = useState([])

	// on 'Mount' setup
	useEffect(() => {
		const getClearLog = () => setHistory([])
		const logRecv = (time, source, level, message) => {
			const item = {
				id: shortid(),
				time,
				source,
				level,
				message,
			}

			setHistory((history) => [item, ...history].slice(0, 500))
		}

		context.socket.emit('log_catchup')
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

	return (
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

					<CButton
						color="danger"
						size="sm"
						className="float-right"
						onClick={doClearLog}
						style={{ opacity: history.length > 0 ? 1 : 0.2 }}
					>
						Clear log
					</CButton>
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
