import { useVirtualizer } from '@tanstack/react-virtual'
import classNames from 'classnames'
import dayjs from 'dayjs'
import { Info } from 'lucide-react'
import { memo, useEffect, useRef } from 'react'
import { useStickyScroll } from '~/Hooks/useStickyScroll.js'
import './LogViewer.css'

/** The levels both log viewers understand. Anything else renders without a badge or tint. */
const KNOWN_LEVELS = ['error', 'warn', 'info', 'debug', 'console'] as const
type KnownLevel = (typeof KNOWN_LEVELS)[number]

/** `fatal` is shown as an error; unknown levels get no badge. */
function normaliseLevel(level: string | undefined): KnownLevel | null {
	if (level === 'fatal') return 'error'
	return KNOWN_LEVELS.includes(level as KnownLevel) ? (level as KnownLevel) : null
}

export interface LogViewerLine {
	time: number | null
	level: string | undefined
	source: string | null | undefined
	message: string
	/** How many identical consecutive lines this row stands for. Omitted means one. */
	count?: number
}

export function LogLevelBadge({
	level,
	fixedWidth,
}: {
	level: string | undefined
	fixedWidth: boolean
}): React.ReactNode {
	const known = normaliseLevel(level)
	if (!known) return null

	return (
		<span className={classNames('log-level-badge', `log-level-badge-${known}`, fixedWidth && 'log-level-badge-fixed')}>
			{known}
		</span>
	)
}

/** The plain notice row both viewers put at the top of the list. */
export function LogNoticeLine({ message }: { message: string }): React.JSX.Element {
	return (
		<div className="log-notice-line">
			<Info className="w-4 h-4 text-sky-500 shrink-0" />
			<span className="break-words min-w-0 flex-1">{message}</span>
		</div>
	)
}

export interface LogLineProps {
	line: LogViewerLine
	/** dayjs format for the timestamp column. */
	timeFormat: string
	/** Extra classes for the timestamp and source columns, which are sized differently per viewer. */
	timeClassName: string
	sourceClassName: string
	/** Right-hand actions revealed on hover (the system log's copy button). */
	actions?: React.ReactNode
	/** Render an empty source column when a line has no source, to keep the columns aligned. */
	alwaysReserveSource: boolean
}

export const LogLine = memo(function LogLine({
	line,
	timeFormat,
	timeClassName,
	sourceClassName,
	actions,
	alwaysReserveSource,
}: LogLineProps) {
	const level = normaliseLevel(line.level)

	return (
		<div className={classNames('group log-line', level && `log-line-${level}`)}>
			<span
				className={classNames(
					'text-muted shrink-0 select-none text-2xs tabular-nums whitespace-nowrap pt-0.5',
					timeClassName
				)}
			>
				{dayjs(line.time).format(timeFormat)}
			</span>

			<div className="shrink-0 flex items-center gap-1.5">
				<LogLevelBadge level={line.level} fixedWidth={alwaysReserveSource} />
				{!!line.count && line.count > 1 && (
					<span className="px-1.5 py-0.5 rounded-full text-3xs font-bold bg-primary/20 text-primary border border-primary/30 shrink-0 select-none">
						x{line.count}
					</span>
				)}
			</div>

			{line.source || alwaysReserveSource ? (
				<span
					className={classNames('font-semibold text-body shrink-0 truncate select-none', sourceClassName)}
					title={line.source ?? undefined}
				>
					{line.source}
				</span>
			) : null}

			<span className="text-body whitespace-pre-wrap break-words min-w-0 flex-1">{line.message}</span>

			{actions}
		</div>
	)
})

export interface VirtualLogListProps<TLine> {
	lines: readonly TLine[]
	/** Rendered above the lines as row 0 — the "older logs are on disk" notice. */
	header: React.ReactNode
	renderLine: (line: TLine) => React.ReactNode
	/** Estimated row height, for the virtualizer. */
	estimateSize: number
	/** Keep the newest line in view as lines arrive. */
	autoScroll: boolean
	className: string
}

/**
 * The virtualized, sticky-scrolling list both log viewers are built on. Row 0 is the header notice;
 * every other row is one line.
 */
export function VirtualLogList<TLine>({
	lines,
	header,
	renderLine,
	estimateSize,
	autoScroll,
	className,
}: VirtualLogListProps<TLine>): React.JSX.Element {
	const parentRef = useRef<HTMLDivElement>(null)
	const count = lines.length + 1

	// eslint-disable-next-line react-hooks/incompatible-library
	const virtualizer = useVirtualizer({
		count,
		getScrollElement: () => parentRef.current,
		estimateSize: () => estimateSize,
		overscan: 10,
	})

	const onScroll = useStickyScroll(parentRef, virtualizer, count)

	useEffect(() => {
		if (autoScroll && parentRef.current && count > 1) {
			virtualizer.scrollToIndex(count - 1, { align: 'end' })
		}
	}, [count, autoScroll, virtualizer])

	const items = virtualizer.getVirtualItems()

	return (
		<div ref={parentRef} className={className} onScroll={onScroll}>
			<div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
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
						<div key={virtualRow.key} data-index={virtualRow.index} ref={virtualizer.measureElement}>
							{virtualRow.index === 0 ? header : renderLine(lines[virtualRow.index - 1])}
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
