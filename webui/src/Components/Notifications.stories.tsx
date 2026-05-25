import type { Meta, StoryObj } from '@storybook/react'
import { useRef } from 'react'
import { NotificationsManager, type NotificationsManagerRef } from './Notifications'

const meta = {
	component: NotificationsManager,
} satisfies Meta<typeof NotificationsManager>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	render: function Render(args) {
		const ref = useRef<NotificationsManagerRef | null>(null)
		return (
			<>
				<button onClick={() => ref.current?.show('Info', 'This is a notification message.')}>Show notification</button>
				<NotificationsManager {...args} ref={ref} />
			</>
		)
	},
}

export const LongDuration: Story = {
	render: function Render(args) {
		const ref = useRef<NotificationsManagerRef | null>(null)
		return (
			<>
				<button onClick={() => ref.current?.show('Long', 'This stays for 30 seconds.', 30000)}>
					Show long notification
				</button>
				<NotificationsManager {...args} ref={ref} />
			</>
		)
	},
}

export const Sticky: Story = {
	render: function Render(args) {
		const ref = useRef<NotificationsManagerRef | null>(null)
		return (
			<>
				<button onClick={() => ref.current?.show('Sticky', 'This notification does not auto-hide.', null)}>
					Show sticky notification
				</button>
				<NotificationsManager {...args} ref={ref} />
			</>
		)
	},
}

export const StickyWithId: Story = {
	render: function Render(args) {
		const ref = useRef<NotificationsManagerRef | null>(null)
		return (
			<>
				<button
					onClick={() => ref.current?.show('Deduped', 'Only one of these will show at a time.', null, 'my-sticky-id')}
				>
					Show (deduplicated by id)
				</button>
				<NotificationsManager {...args} ref={ref} />
			</>
		)
	},
}

export const ProgrammaticClose: Story = {
	render: function Render(args) {
		const ref = useRef<NotificationsManagerRef | null>(null)
		const idRef = useRef<string | null>(null)
		return (
			<>
				<button
					onClick={() => {
						idRef.current = ref.current?.show('Closeable', 'Click "Close" to dismiss.', null) ?? null
					}}
				>
					Show notification
				</button>
				<button onClick={() => idRef.current && ref.current?.close(idRef.current)}>Close notification</button>
				<NotificationsManager {...args} ref={ref} />
			</>
		)
	},
}
