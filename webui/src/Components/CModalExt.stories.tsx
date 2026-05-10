import { CModalBody, CModalFooter, CModalHeader, CModalTitle } from '@coreui/react'
import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { CModalExt } from './CModalExt'

const meta = {
	component: CModalExt,
	args: {
		visible: false,
		children: null,
	},
} satisfies Meta<typeof CModalExt>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	render: function Render(args) {
		const [visible, setVisible] = useState(false)
		return (
			<>
				<button onClick={() => setVisible(true)}>Open Modal</button>
				<CModalExt {...args} visible={visible} onClose={() => setVisible(false)}>
					<CModalHeader>
						<CModalTitle>Example Modal</CModalTitle>
					</CModalHeader>
					<CModalBody>This is the modal body content.</CModalBody>
					<CModalFooter>
						<button onClick={() => setVisible(false)}>Close</button>
					</CModalFooter>
				</CModalExt>
			</>
		)
	},
}

export const WithCallbacks: Story = {
	render: function Render(args) {
		const [visible, setVisible] = useState(false)
		const [log, setLog] = useState<string[]>([])
		const addLog = (msg: string) => setLog((prev) => [...prev, msg])
		return (
			<>
				<button onClick={() => setVisible(true)}>Open Modal</button>
				<ul>
					{log.map((entry, i) => (
						<li key={i}>{entry}</li>
					))}
				</ul>
				<CModalExt
					{...args}
					visible={visible}
					onClose={() => setVisible(false)}
					onOpened={() => addLog('onOpened fired')}
					onClosed={() => addLog('onClosed fired')}
				>
					<CModalHeader>
						<CModalTitle>With Callbacks</CModalTitle>
					</CModalHeader>
					<CModalBody>Open/close and watch the log below.</CModalBody>
					<CModalFooter>
						<button onClick={() => setVisible(false)}>Close</button>
					</CModalFooter>
				</CModalExt>
			</>
		)
	},
}
