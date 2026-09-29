import type { Meta, StoryObj } from '@storybook/react'
import { Button, ButtonGroup, LinkButton, LinkButtonExternal } from './Button'

const meta = {
	component: Button,
	args: {
		children: 'Button',
		color: 'primary',
	},
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Ghost: Story = { args: { variant: 'ghost' } }

export const Small: Story = { args: { size: 'sm' } }

export const Disabled: Story = { args: { disabled: true, children: 'Disabled' } }

export const Hidden: Story = { args: { hidden: true, children: 'Hidden (not rendered)' } }

/** Static previews alongside the real hover/focus interactions, on both common page surfaces. */
export const StateMatrix: Story = {
	render: function Render() {
		const treatments = [
			{ label: 'Primary', color: 'primary' },
			{ label: 'Secondary', color: 'secondary' },
			{ label: 'Ghost', variant: 'ghost' },
			{ label: 'Danger', color: 'danger', variant: 'ghost' },
			{ label: 'Confirmation', color: 'danger' },
		] as const
		return (
			<div className="button-state-matrix space-y-6">
				<style>{`
					.button-state-matrix [data-preview-state="hover"] {
						color: var(--btn-hover-color);
						background: var(--btn-hover-bg);
						border-color: var(--btn-hover-border-color);
					}
					.button-state-matrix [data-preview-state="pressed"] {
						color: var(--btn-active-color);
						background: var(--btn-active-bg);
						border-color: var(--btn-active-border-color);
					}
					.button-state-matrix [data-preview-state="focus"] {
						outline: 2px solid var(--color-action-focus);
						outline-offset: 2px;
					}
				`}</style>
				{['bg-surface', 'bg-surface-muted'].map((surface) => (
					<div key={surface} className={`${surface} p-4 overflow-x-auto`}>
						<table>
							<thead>
								<tr>
									{['Treatment', 'Rest', 'Hover', 'Focus', 'Pressed', 'Selected', 'Disabled', 'Busy'].map((label) => (
										<th key={label} className="p-2">
											{label}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{treatments.map(({ label, ...props }) => (
									<tr key={label}>
										<th className="p-2">{label}</th>
										{['rest', 'hover', 'focus', 'pressed', 'selected', 'disabled', 'busy'].map((state) => (
											<td key={state} className="p-2">
												<Button
													{...props}
													size="sm"
													data-preview-state={state}
													active={state === 'selected'}
													disabled={state === 'disabled' || state === 'busy'}
													aria-busy={state === 'busy'}
												>
													{state === 'busy' ? 'Saving…' : 'Action'}
												</Button>
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				))}
			</div>
		)
	},
}

export const AllColors: Story = {
	argTypes: {
		color: { table: { disable: true } },
		variant: { control: 'radio', options: [undefined, 'ghost', 'outline'] },
		size: { control: 'radio', options: [undefined, 'sm'] },
		disabled: { control: 'boolean' },
	},
	render: function Render({ variant, size, disabled }) {
		const colors = [
			'primary',
			'secondary',
			'success',
			'danger',
			'warning',
			'info',
			'light',
			'dark',
			'disabled',
			'link',
		] as const
		return (
			<div className="flex gap-2 flex-wrap">
				{colors.map((color) => (
					<Button key={color} color={color} variant={variant} size={size} disabled={disabled}>
						{color}
					</Button>
				))}
			</div>
		)
	},
}

export const InternalLink: StoryObj<typeof LinkButton> = {
	render: (args) => <LinkButton {...args} />,
	args: {
		children: 'Go to connections',
		color: 'primary',
		to: '/connections',
	},
}

export const ExternalLink: StoryObj<typeof LinkButtonExternal> = {
	render: (args) => <LinkButtonExternal {...args} />,
	args: {
		children: 'Open docs',
		color: 'info',
		href: 'https://bitfocus.io',
		target: '_blank',
		rel: 'noopener noreferrer',
	},
}

export const Group: StoryObj<typeof ButtonGroup> = {
	render: (args) => (
		<ButtonGroup {...args}>
			<Button color="primary">Left</Button>
			<Button color="primary">Middle</Button>
			<Button color="primary">Right</Button>
		</ButtonGroup>
	),
}

export const GroupVertical: StoryObj<typeof ButtonGroup> = {
	render: (args) => (
		<ButtonGroup {...args} vertical>
			<Button color="primary">Top</Button>
			<Button color="primary">Middle</Button>
			<Button color="primary">Bottom</Button>
		</ButtonGroup>
	),
}

export const GroupMixedColors: StoryObj<typeof ButtonGroup> = {
	render: (args) => (
		<ButtonGroup {...args}>
			<Button color="success">Save</Button>
			<Button color="warning">Reset</Button>
			<Button color="danger">Delete</Button>
		</ButtonGroup>
	),
}
