import type { Meta, StoryObj } from '@storybook/react'
import { Table } from './Table'

const meta = {
	component: Table,
	parameters: {
		layout: 'padded',
	},
} satisfies Meta<typeof Table>

export default meta
type Story = StoryObj<typeof meta>

const SampleRows = () => (
	<>
		<thead>
			<tr>
				<th>Name</th>
				<th>Type</th>
				<th className="fit">Enabled</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td>Main mixer</td>
				<td>OSC</td>
				<td>Yes</td>
			</tr>
			<tr>
				<td>Lighting desk</td>
				<td>Art-Net</td>
				<td>No</td>
			</tr>
			<tr>
				<td>Playback</td>
				<td>HTTP</td>
				<td>Yes</td>
			</tr>
		</tbody>
	</>
)

// Default: the framed, small-screen-scrollable companion look (responsive defaults to true)
export const Default: Story = {
	render: () => (
		<Table>
			<SampleRows />
		</Table>
	),
}

// A plain, unframed table
export const Plain: Story = {
	render: () => (
		<Table responsive={false}>
			<SampleRows />
		</Table>
	),
}

// Condensed cell padding
export const Small: Story = {
	render: () => (
		<Table size="sm">
			<SampleRows />
		</Table>
	),
}

// Zebra-striped body rows
export const Striped: Story = {
	render: () => (
		<Table striped responsive={false}>
			<SampleRows />
		</Table>
	),
}

// Tighter rows, as used by the module lists
export const Tight: Story = {
	render: () => (
		<Table className="table-tight">
			<SampleRows />
		</Table>
	),
}

// Minimal, left-aligned cells, as used by the settings pages
export const Settings: Story = {
	render: () => (
		<Table className="table-settings">
			<SampleRows />
		</Table>
	),
}
