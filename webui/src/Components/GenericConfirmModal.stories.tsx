import type { Meta, StoryObj } from '@storybook/react'
import { useRef } from 'react'
import { GenericConfirmModal, type GenericConfirmModalRef } from './GenericConfirmModal'

const meta = {
	component: GenericConfirmModal,
} satisfies Meta<typeof GenericConfirmModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	render: function Render(args) {
		const ref = useRef<GenericConfirmModalRef | null>(null)
		return (
			<>
				<button
					onClick={() =>
						ref.current?.show('Confirm Action', 'Are you sure you want to proceed?', 'Confirm', () =>
							console.log('confirmed')
						)
					}
				>
					Open Confirm Modal
				</button>
				<GenericConfirmModal {...args} ref={ref} />
			</>
		)
	},
}

export const MultiLineMessage: Story = {
	render: function Render(args) {
		const ref = useRef<GenericConfirmModalRef | null>(null)
		return (
			<>
				<button
					onClick={() =>
						ref.current?.show(
							'Delete Page',
							['This will permanently delete the page.', 'All buttons on this page will be lost.'],
							'Delete',
							() => console.log('deleted')
						)
					}
				>
					Open Multi-line Modal
				</button>
				<GenericConfirmModal {...args} ref={ref} />
			</>
		)
	},
}

export const WithCustomContent: Story = {
	args: { content: <em>Custom content rendered via props.</em> },
	render: function Render(args) {
		const ref = useRef<GenericConfirmModalRef | null>(null)
		return (
			<>
				<button onClick={() => ref.current?.show('Custom', null, 'OK', () => console.log('ok'))}>
					Open Custom Modal
				</button>
				<GenericConfirmModal {...args} ref={ref} />
			</>
		)
	},
}
