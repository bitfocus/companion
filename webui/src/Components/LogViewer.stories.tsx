import type { Meta, StoryObj } from '@storybook/react'
import { useEffect, useState } from 'react'
import { LogLevelBadge, LogLine, LogNoticeLine, VirtualLogList, type LogViewerLine } from './LogViewer'

const meta = {
	component: VirtualLogList<LogViewerLine>,
	decorators: [
		(Story) => (
			<div style={{ padding: 24, background: 'var(--color-surface)' }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof VirtualLogList<LogViewerLine>>

export default meta
type Story = StoryObj<typeof meta>

const START = Date.parse('2026-01-01T12:00:00Z')

const SAMPLE_LINES: LogViewerLine[] = [
	{ time: START, level: 'info', source: 'Instance/Controller', message: 'Starting connection atem-1' },
	{ time: START + 120, level: 'debug', source: 'Instance/atem-1', message: 'Connecting to 10.0.0.20:9910' },
	{ time: START + 900, level: 'warn', source: 'Instance/atem-1', message: 'No response, retrying', count: 4 },
	{ time: START + 4500, level: 'error', source: 'Instance/atem-1', message: 'Connection failed: ETIMEDOUT' },
	{ time: START + 4600, level: 'console', source: 'Instance/atem-1', message: 'console.log output from the module' },
	{
		time: START + 5000,
		level: 'fatal',
		source: 'Surface/USB',
		message: 'Stack trace:\n  at openDevice (usb.js:12)\n  at Surface.init (surface.js:40)',
	},
	{ time: START + 6000, level: 'trace', source: null, message: 'A line with an unknown level and no source' },
]

function renderLine(line: LogViewerLine): React.ReactNode {
	return (
		<LogLine
			line={line}
			timeFormat="HH:mm:ss.SSS"
			timeClassName=""
			sourceClassName="log-source-cell text-2xs pt-0.5"
			alwaysReserveSource={false}
		/>
	)
}

const LIST_CLASS = 'w-full h-full overflow-auto font-mono text-xs select-text scrollbar-thin'

export const Default: Story = {
	args: {
		lines: SAMPLE_LINES,
		header: <LogNoticeLine message="Only lines generated since opening this tab are shown here" />,
		renderLine,
		estimateSize: 28,
		autoScroll: true,
		className: LIST_CLASS,
	},
	render: (args) => (
		<div style={{ height: 320 }}>
			<VirtualLogList {...args} />
		</div>
	),
}

/** New lines are appended every 500ms; the list stays pinned to the bottom unless scrolled up. */
function StreamingLog() {
	const [lines, setLines] = useState<LogViewerLine[]>(SAMPLE_LINES)
	useEffect(() => {
		const interval = setInterval(() => {
			setLines((old) => {
				const next = SAMPLE_LINES[old.length % SAMPLE_LINES.length]
				return [...old, { ...next, time: Date.now(), count: undefined }].slice(-500)
			})
		}, 500)
		return () => clearInterval(interval)
	}, [])

	return (
		<div style={{ height: 320 }}>
			<VirtualLogList
				lines={lines}
				header={<LogNoticeLine message="Older logs on disk: /var/log/companion" />}
				renderLine={renderLine}
				estimateSize={28}
				autoScroll
				className={LIST_CLASS}
			/>
		</div>
	)
}

export const Streaming: Story = {
	args: Default.args,
	render: () => <StreamingLog />,
}

export const LevelBadges: Story = {
	args: Default.args,
	render: () => (
		<div className="flex flex-col gap-2 font-mono text-xs">
			{['error', 'fatal', 'warn', 'info', 'debug', 'console', 'unknown'].map((level) => (
				<div key={level} className="flex items-center gap-3">
					<span className="w-16 text-muted">{level}</span>
					<LogLevelBadge level={level} fixedWidth={false} />
					<LogLevelBadge level={level} fixedWidth={true} />
				</div>
			))}
		</div>
	),
}
