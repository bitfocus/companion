import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { StatusFilterPill } from './StatusFilterPill'

const meta = {
	component: StatusFilterPill,
	decorators: [
		(Story) => (
			<div style={{ padding: 24, background: 'var(--color-surface)' }}>
				<Story />
			</div>
		),
	],
	args: { onClick: () => {} },
} satisfies Meta<typeof StatusFilterPill>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: { label: 'Errors', count: 3, dotClass: 'bg-tone-error-fill', isActive: false },
}

export const Active: Story = {
	args: { label: 'Errors', count: 3, dotClass: 'bg-tone-error-fill', isActive: true },
}

export const Empty: Story = {
	args: { label: 'Warnings', count: 0, dotClass: 'bg-tone-warning-fill', isActive: false },
}

export const WithoutDot: Story = {
	args: { label: 'All', count: 12, isActive: false },
}

const FILTERS = [
	{ id: 'ok', label: 'OK', count: 8, dotClass: 'bg-tone-good-fill' },
	{ id: 'warning', label: 'Warnings', count: 2, dotClass: 'bg-tone-warning-fill' },
	{ id: 'error', label: 'Errors', count: 1, dotClass: 'bg-tone-error-fill' },
	{ id: 'disabled', label: 'Disabled', count: 0, dotClass: 'bg-tone-neutral-fill' },
]

function FilterRow() {
	const [active, setActive] = useState<string | null>(null)
	return (
		<div className="flex flex-wrap gap-2">
			{FILTERS.map((f) => (
				<StatusFilterPill
					key={f.id}
					label={f.label}
					count={f.count}
					dotClass={f.dotClass}
					isActive={active === f.id}
					onClick={() => setActive((cur) => (cur === f.id ? null : f.id))}
				/>
			))}
		</div>
	)
}

export const FilterGroup: Story = {
	args: { label: 'OK', count: 8, isActive: false },
	render: () => <FilterRow />,
}
