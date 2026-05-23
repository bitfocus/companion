import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Modal } from './Modal'

const meta = {
	component: Modal.Root,
} satisfies Meta<typeof Modal.Root>

export default meta
type Story = StoryObj<typeof meta>

// ─── Default (uncontrolled, trigger inside Root) ──────────────────────────────

export const Default: Story = {
	render: function Render(args) {
		return (
			<Modal.Root {...args}>
				<Modal.Trigger>Open modal</Modal.Trigger>
				<Modal.Portal>
					<Modal.Backdrop />
					<Modal.Viewport>
						<Modal.Popup>
							<Modal.Header closeButton>
								<Modal.Title>Example modal</Modal.Title>
							</Modal.Header>
							<Modal.Body>
								<p>This is the modal body content.</p>
							</Modal.Body>
							<Modal.Footer>
								<Modal.Close>Cancel</Modal.Close>
								<button onClick={() => {}}>Confirm</button>
							</Modal.Footer>
						</Modal.Popup>
					</Modal.Viewport>
				</Modal.Portal>
			</Modal.Root>
		)
	},
}

// ─── Controlled ───────────────────────────────────────────────────────────────

export const Controlled: Story = {
	render: function Render(args) {
		const [open, setOpen] = useState(false)
		return (
			<>
				<button onClick={() => setOpen(true)}>Open modal</button>
				<Modal.Root {...args} open={open} onOpenChange={setOpen}>
					<Modal.Portal>
						<Modal.Backdrop />
						<Modal.Viewport>
							<Modal.Popup>
								<Modal.Title>Controlled modal</Modal.Title>
								<Modal.Description>This dialog's open state is managed externally with useState.</Modal.Description>
								<Modal.Close>Close</Modal.Close>
							</Modal.Popup>
						</Modal.Viewport>
					</Modal.Portal>
				</Modal.Root>
			</>
		)
	},
}

// ─── With open/close callbacks ────────────────────────────────────────────────

export const WithCallbacks: Story = {
	render: function Render(args) {
		const [log, setLog] = useState<string[]>([])
		const addLog = (msg: string) => setLog((prev) => [...prev, msg])
		return (
			<>
				<Modal.Root
					{...args}
					onOpenChange={(open) => addLog(open ? 'onOpenChange: open' : 'onOpenChange: closed')}
					onOpenChangeComplete={(open) => addLog(open ? 'onOpenChangeComplete: open' : 'onOpenChangeComplete: closed')}
				>
					<Modal.Trigger>Open modal</Modal.Trigger>
					<Modal.Portal>
						<Modal.Backdrop />
						<Modal.Viewport>
							<Modal.Popup>
								<Modal.Title>Callback demo</Modal.Title>
								<Modal.Description>Open and close to see events logged below.</Modal.Description>
								<Modal.Close>Close</Modal.Close>
							</Modal.Popup>
						</Modal.Viewport>
					</Modal.Portal>
				</Modal.Root>
				<ul style={{ marginTop: '1rem', fontFamily: 'monospace' }}>
					{log.map((entry, i) => (
						<li key={i}>{entry}</li>
					))}
				</ul>
			</>
		)
	},
}

// ─── Non-modal (no focus trap) ────────────────────────────────────────────────

export const NonModal: Story = {
	render: function Render(args) {
		return (
			<Modal.Root {...args} modal={false}>
				<Modal.Trigger>Open non-modal</Modal.Trigger>
				<Modal.Portal>
					<Modal.Viewport>
						<Modal.Popup>
							<Modal.Title>Non-modal dialog</Modal.Title>
							<Modal.Description>
								Focus is not trapped — you can interact with the page behind this dialog.
							</Modal.Description>
							<Modal.Close>Close</Modal.Close>
						</Modal.Popup>
					</Modal.Viewport>
				</Modal.Portal>
			</Modal.Root>
		)
	},
}

// ─── Nested dialogs ───────────────────────────────────────────────────────────

export const Nested: Story = {
	render: function Render(args) {
		return (
			<Modal.Root {...args}>
				<Modal.Trigger>Open outer modal</Modal.Trigger>
				<Modal.Portal>
					<Modal.Backdrop />
					<Modal.Viewport>
						<Modal.Popup>
							<Modal.Title>Outer modal</Modal.Title>
							<Modal.Description>This modal contains a nested dialog.</Modal.Description>

							<Modal.Root>
								<Modal.Trigger>Open inner modal</Modal.Trigger>
								<Modal.Portal>
									<Modal.Backdrop />
									<Modal.Viewport>
										<Modal.Popup>
											<Modal.Title>Inner modal</Modal.Title>
											<Modal.Description>This is a nested dialog.</Modal.Description>
											<Modal.Close>Close inner</Modal.Close>
										</Modal.Popup>
									</Modal.Viewport>
								</Modal.Portal>
							</Modal.Root>

							<Modal.Close>Close outer</Modal.Close>
						</Modal.Popup>
					</Modal.Viewport>
				</Modal.Portal>
			</Modal.Root>
		)
	},
}

// ─── Multiple triggers ────────────────────────────────────────────────────────

export const MultipleTriggers: Story = {
	render: function Render(args) {
		return (
			<Modal.Root {...args}>
				<Modal.Trigger>Trigger 1</Modal.Trigger>
				<Modal.Trigger style={{ marginLeft: '0.5rem' }}>Trigger 2</Modal.Trigger>
				<Modal.Portal>
					<Modal.Backdrop />
					<Modal.Viewport>
						<Modal.Popup>
							<Modal.Title>Multiple triggers</Modal.Title>
							<Modal.Description>Either trigger button opens this same dialog.</Modal.Description>
							<Modal.Close>Close</Modal.Close>
						</Modal.Popup>
					</Modal.Viewport>
				</Modal.Portal>
			</Modal.Root>
		)
	},
}

// ─── Sizes ────────────────────────────────────────────────────────────────────

const sizeVariants: Array<{ label: string; size: 'sm' | 'lg' | 'xl' | undefined }> = [
	{ label: 'sm (300px)', size: 'sm' },
	{ label: 'Default (500px)', size: undefined },
	{ label: 'lg (800px)', size: 'lg' },
	{ label: 'xl (1140px)', size: 'xl' },
]

export const Sizes: Story = {
	render: function Render(args) {
		return (
			<div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
				{sizeVariants.map(({ label, size }) => (
					<Modal.Root key={label} {...args}>
						<Modal.Trigger>{label}</Modal.Trigger>
						<Modal.Portal>
							<Modal.Backdrop />
							<Modal.Viewport>
								<Modal.Popup size={size}>
									<Modal.Header closeButton>
										<Modal.Title>{label}</Modal.Title>
									</Modal.Header>
									<Modal.Body>
										<p>This is the {size ?? 'default'} size variant.</p>
									</Modal.Body>
								</Modal.Popup>
							</Modal.Viewport>
						</Modal.Portal>
					</Modal.Root>
				))}
			</div>
		)
	},
}
