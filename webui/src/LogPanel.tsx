import { faClipboardList } from '@fortawesome/free-solid-svg-icons'
import { useQuery } from '@tanstack/react-query'
import { useSubscription } from '@trpc/tanstack-react-query'
import copy from 'copy-to-clipboard'
import dayjs from 'dayjs'
import { AlertCircle, AlertTriangle, Bug, Check, Copy, Download, FileText, Info, Search, Trash2, X } from 'lucide-react'
import { nanoid } from 'nanoid'
import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ClientLogLine } from '@companion-app/shared/Model/LogLine.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { LogLine, LogNoticeLine, VirtualLogList } from '~/Components/LogViewer.js'
import { PillButton, type PillTone } from '~/Components/PillButton.js'
import { safeSetLocalStorage } from '~/Helpers/SafeStorage.js'
import { PageHeader } from '~/Layout/PageHeader.js'
import { assertNever, makeAbsolutePath, useDebounced } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { trpc, useMutationExt } from './Resources/TRPC'

interface LogConfig {
	error?: boolean
	warn: boolean
	info: boolean
	debug: boolean
}

const LOG_LEVELS = [
	{ key: 'error', label: 'Error', icon: AlertCircle, tone: 'error' },
	{ key: 'warn', label: 'Warn', icon: AlertTriangle, tone: 'warning' },
	{ key: 'info', label: 'Info', icon: Info, tone: 'info' },
	{ key: 'debug', label: 'Debug', icon: Bug, tone: 'neutral' },
] as const satisfies readonly { key: keyof LogConfig; label: string; icon: typeof Info; tone: PillTone }[]

/** `error` defaults to on, so it is the only level where `undefined` means enabled. */
function isLevelEnabled(config: LogConfig, key: keyof LogConfig): boolean {
	return key === 'error' ? config.error !== false : !!config[key]
}

interface ClientLogLineExt extends Omit<ClientLogLine, 'time'> {
	id?: string
	time: number | null
}

export interface GroupedLogLine extends ClientLogLineExt {
	count: number
}

export const LogPanel = memo(function LogPanel() {
	const [config, setConfig] = useState<LogConfig>(() => loadConfig())
	const [searchQuery, setSearchQuery] = useState('')
	const [deduplicate, setDeduplicate] = useState(true)
	const [copiedAll, setCopiedAll] = useState(false)

	const exportRef = useRef<GenericConfirmModalRef>(null)
	const { notifier } = useContext(RootAppStoreContext)

	// Save the config when it changes
	useEffect(() => {
		safeSetLocalStorage('debug_config', JSON.stringify(config))
	}, [config])

	const clearLogMutation = useMutationExt(trpc.logs.clear.mutationOptions())
	const doClearLog = useCallback(() => {
		clearLogMutation
			.mutateAsync()
			.then(() => {
				notifier.show('Logs Cleared', 'All log history has been cleared', 2500)
			})
			.catch((e) => {
				console.error('Log clear failed', e)
			})
	}, [clearLogMutation, notifier])

	const doToggleConfig = useCallback((key: keyof LogConfig) => {
		setConfig((oldConfig) => ({
			...oldConfig,
			[key]: !oldConfig[key],
		}))
	}, [])

	const exportSupportModal = useCallback(() => {
		exportRef.current?.show(
			'Export Support Bundle',
			[
				'This packages up your recent Companion logs, configuration and backups.',
				'This may contain sensitive information, such as connection information to online services. It is not recommended to post this publicly, rather you should send it privately to a trusted party who is able to help you with an issue.',
			],
			'Export',
			() => {
				window.open(makeAbsolutePath('/int/export/support'))
			}
		)
	}, [])

	const { history } = useLogHistory()

	// Filter, count and deduplicate in one pass over the buffer (up to 5000 lines, re-run on every
	// incoming batch). The search runs over the whole buffer, so it is debounced rather than re-run on
	// every keystroke.
	const debouncedSearchQuery = useDebounced(searchQuery, 150)
	const { counts, processedMessages } = useMemo(() => {
		const query = debouncedSearchQuery.toLowerCase()
		const counts = { error: 0, warn: 0, info: 0, debug: 0 }
		const processedMessages: GroupedLogLine[] = []

		for (const msg of history) {
			const level = msg.level === 'fatal' ? 'error' : msg.level
			if (level === 'error' || level === 'warn' || level === 'info' || level === 'debug') {
				counts[level]++
				if (!isLevelEnabled(config, level)) continue
			}

			if (query) {
				const matchMsg = msg.message?.toLowerCase().includes(query)
				const matchSrc = msg.source?.toLowerCase().includes(query)
				const matchLvl = msg.level?.toLowerCase().includes(query)
				if (!matchMsg && !matchSrc && !matchLvl) continue
			}

			const prev = processedMessages[processedMessages.length - 1]
			if (
				deduplicate &&
				prev &&
				prev.level === msg.level &&
				prev.source === msg.source &&
				prev.message === msg.message
			) {
				prev.count += 1
				prev.time = msg.time
			} else {
				processedMessages.push({ ...msg, count: 1 })
			}
		}

		return { counts, processedMessages }
	}, [history, config, debouncedSearchQuery, deduplicate])

	const handleCopyAll = useCallback(() => {
		const dump = processedMessages
			.map(
				(m) =>
					`[${m.time ? dayjs(m.time).format('YYYY-MM-DD HH:mm:ss.SSS') : 'SYS'}] [${(m.level || 'INFO').toUpperCase()}] [${m.source}] ${m.message}${m.count > 1 ? ` (x${m.count})` : ''}`
			)
			.join('\n')

		void copy(dump)
			.then((copied) => {
				if (!copied) throw new Error('Clipboard copy was rejected')
				setCopiedAll(true)
				notifier.show('Logs Copied', `Copied ${processedMessages.length} log lines to clipboard`, 2500)
				setTimeout(() => setCopiedAll(false), 2000)
			})
			.catch(() => notifier.show('Copy Failed', 'Could not copy logs to the clipboard', 2500))
	}, [processedMessages, notifier])

	return (
		<>
			<GenericConfirmModal ref={exportRef} />
			<div className="page-shell">
				<PageHeader icon={faClipboardList} title="System Log" helpAction="/user-guide/log" />

				{/* Top Controls Bar */}
				<div className="bg-surface-muted/60 border border-border/80 p-3 rounded-xl flex flex-col gap-3 shrink-0 shadow-xs">
					<div className="flex items-center justify-between gap-3 flex-wrap">
						{/* Severity Filter Pills */}
						<div className="flex items-center gap-1.5 flex-wrap">
							<span className="text-xs font-semibold text-body me-1">Filters:</span>

							{LOG_LEVELS.map(({ key, label, icon: Icon, tone }) => (
								<PillButton
									key={key}
									small
									tone={tone}
									active={isLevelEnabled(config, key)}
									onClick={() => doToggleConfig(key)}
								>
									<Icon className="w-3.5 h-3.5" />
									<span>
										{label} ({counts[key]})
									</span>
								</PillButton>
							))}
						</div>

						{/* Top Actions */}
						<div className="flex items-center gap-2 flex-wrap">
							<PillButton
								tone="primary"
								active={deduplicate}
								onClick={() => setDeduplicate(!deduplicate)}
								title="Collapse repetitive consecutive log lines"
							>
								<span>Group Repeats</span>
							</PillButton>

							<PillButton tone="primary" active={false} onClick={handleCopyAll} title="Copy filtered logs to clipboard">
								{copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
								<span>Copy</span>
							</PillButton>

							<PillButton
								tone="primary"
								active={false}
								onClick={doClearLog}
								className="hover:text-rose-500"
								title="Clear active log history"
							>
								<Trash2 className="w-3.5 h-3.5" />
								<span>Clear</span>
							</PillButton>

							<a
								href={makeAbsolutePath('/int/export/log')}
								target="_blank"
								rel="noopener noreferrer"
								className="pill-button pill-tone-primary"
								title="Download raw log file"
							>
								<FileText className="w-3.5 h-3.5" />
								<span>Export Log</span>
							</a>

							<PillButton
								tone="primary"
								active={false}
								onClick={exportSupportModal}
								title="Download full support bundle"
							>
								<Download className="w-3.5 h-3.5" />
								<span>Support Bundle</span>
							</PillButton>
						</div>
					</div>

					{/* Search Filter Bar */}
					<div className="relative flex items-center">
						<Search className="w-4 h-4 absolute left-3 text-muted pointer-events-none" />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search logs by keyword, source, or message (e.g. atem, connection, timeout)..."
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
					<LogPanelContents messages={processedMessages} />
				</div>
			</div>
		</>
	)
})

function useLogHistory() {
	const [history, setHistory] = useState<ClientLogLineExt[]>([])

	useSubscription(
		trpc.logs.watch.subscriptionOptions(undefined, {
			onStarted: () => {
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
	messages: GroupedLogLine[]
}

function LogPanelContents({ messages }: LogPanelContentsProps) {
	const { data: appInfo } = useQuery(trpc.appInfo.version.queryOptions())

	const noticeMessage = appInfo?.logsDir
		? `Older logs on disk: ${appInfo.logsDir}`
		: 'For older logs check the console output or system logs where Companion was started.'

	return (
		<VirtualLogList
			lines={messages}
			header={<LogNoticeLine message={noticeMessage} />}
			renderLine={(line) => <SystemLogLine line={line} />}
			estimateSize={28}
			autoScroll={true}
			className="w-full h-full overflow-auto font-mono text-xs select-text scrollbar-thin"
		/>
	)
}

const SystemLogLine = memo(function SystemLogLine({ line }: { line: GroupedLogLine }) {
	const [copied, setCopied] = useState(false)

	const handleCopy = (e: React.MouseEvent) => {
		e.stopPropagation()
		const str = `[${dayjs(line.time).format('YYYY-MM-DD HH:mm:ss.SSS')}] [${line.level?.toUpperCase()}] [${line.source}] ${line.message}`
		void copy(str)
			.then((copied) => {
				if (!copied) return
				setCopied(true)
				setTimeout(() => setCopied(false), 1500)
			})
			.catch(() => undefined)
	}

	return (
		<LogLine
			line={line}
			timeFormat="HH:mm:ss.SSS"
			timeClassName=""
			sourceClassName="log-source-cell text-2xs pt-0.5"
			alwaysReserveSource={false}
			actions={
				<button
					type="button"
					onClick={handleCopy}
					className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted hover:text-body shrink-0 cursor-pointer bg-transparent border-0 shadow-none outline-none inline-flex items-center justify-center rounded hover:bg-surface-muted"
					title="Copy log line"
				>
					{copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
				</button>
			}
		/>
	)
})

function loadConfig(): LogConfig {
	try {
		const rawConfig = window.localStorage.getItem('debug_config')
		if (!rawConfig) throw new Error()
		const config = JSON.parse(rawConfig)
		if (!config) throw new Error()
		return {
			error: config.error !== false,
			warn: config.warn ?? true,
			info: config.info ?? false,
			debug: config.debug ?? false,
		}
	} catch (_e) {
		const config: LogConfig = {
			error: true,
			warn: true,
			info: false,
			debug: false,
		}

		safeSetLocalStorage('debug_config', JSON.stringify(config))
		return config
	}
}
