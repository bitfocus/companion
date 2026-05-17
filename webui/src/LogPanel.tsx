import { CCol, CRow } from '@coreui/react'
import { faFileExport } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useSubscription } from '@trpc/tanstack-react-query'
import dayjs from 'dayjs'
import { nanoid } from 'nanoid'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ClientLogLine } from '@companion-app/shared/Model/LogLine.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { useStickyScroll } from '~/Hooks/useStickyScroll.js'
import { assertNever, makeAbsolutePath } from '~/Resources/util.js'
import { Button, ButtonGroup, LinkButtonExternal } from './Components/Button'
import { trpc, useMutationExt } from './Resources/TRPC'

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
	const [config, setConfig] = useState<LogConfig>(() => loadConfig())
	const exportRef = useRef<GenericConfirmModalRef>(null)

	// Save the config when it changes
	useEffect(() => {
		window.localStorage.setItem('debug_config', JSON.stringify(config))
	}, [config])

	const clearLogMutation = useMutationExt(trpc.logs.clear.mutationOptions())
	const doClearLog = useCallback(() => {
		clearLogMutation.mutateAsync().catch((e) => {
			console.error('Log clear failed', e)
		})
	}, [clearLogMutation])

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
				window.open(makeAbsolutePath('/int/export/support'))
			}
		)
	}, [])

	return (
		<>
			<GenericConfirmModal ref={exportRef} />
			<div className="log-page">
				<CRow>
					<CCol lg={12} className="log-buttons">
						<ButtonGroup>
							<Button color="warning" size="sm" onClick={doToggleWarn} variant={config.warn ? undefined : 'outline'}>
								Warning
							</Button>
							<Button color="info" size="sm" onClick={doToggleInfo} variant={config.info ? undefined : 'outline'}>
								Info
							</Button>
							<Button
								color="secondary"
								size="sm"
								onClick={doToggleDebug}
								variant={config.debug ? undefined : 'outline'}
							>
								Debug
							</Button>
						</ButtonGroup>

						<div className="float-right">
							<Button color="primary" size="sm" onClick={doClearLog}>
								Clear log
							</Button>
							<LinkButtonExternal color="light" className="ms-2" size="sm" href={makeAbsolutePath(`/int/export/log`)}>
								<FontAwesomeIcon icon={faFileExport} /> Export log
							</LinkButtonExternal>
							<Button color="light" className="ms-2" onClick={exportSupportModal} size="sm">
								<FontAwesomeIcon icon={faFileExport} /> Export support bundle
							</Button>
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

function useLogHistory() {
	const [history, setHistory] = useState<ClientLogLineExt[]>([])

	useSubscription(
		trpc.logs.watch.subscriptionOptions(undefined, {
			onStarted: () => {
				// Reset history on start
				setHistory([])
			},
			onData: (data) => {
				switch (data.type) {
					case 'clear':
						setHistory([])
						break
					case 'lines': {
						if (data.lines.length === 0) return

						const newItems: ClientLogLineExt[] = data.lines.map((item) => ({ ...item, id: nanoid() }))

						setHistory((history) => {
							const newArray = [...history, ...newItems]

							if (newArray.length > 5000) {
								return newArray.slice(-4500)
							} else {
								return newArray
							}
						})
						break
					}

					default:
						assertNever(data)
						break
				}
			},
			onError: (error) => {
				console.error('Log subscription error', error)
			},
		})
	)

	return { history }
}

interface LogPanelContentsProps {
	config: LogConfig
}
function LogPanelContents({ config }: LogPanelContentsProps) {
	const { history } = useLogHistory()

	const parentRef = useRef<HTMLDivElement>(null)

	const messages = useMemo(() => {
		return history.filter((msg) => msg.level === 'error' || !!config[msg.level as keyof LogConfig])
	}, [history, config])

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
	line: ClientLogLineExt
}
const LogLineInner = memo(({ line }: LogLineInnerProps) => {
	const time_format = line.time === null ? '                 ' : dayjs(line.time).format('YY.MM.DD HH:mm:ss')
	return (
		<div className={`log-line log-type-${line.level}`}>
			{time_format} <strong>{line.source}</strong>: <span className="log-message">{line.message}</span>
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
	} catch (_e) {
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
