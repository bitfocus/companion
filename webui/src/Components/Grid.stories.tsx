import type { Meta, StoryObj } from '@storybook/react'
import { Grid } from './Grid'

const meta = {
	component: Grid.Row,
	parameters: {
		layout: 'padded',
	},
} satisfies Meta<typeof Grid.Row>

export default meta
type Story = StoryObj<typeof meta>

export const RowDefault: Story = {
	render: () => (
		<Grid.Row>
			<Grid.Col xs={6} style={{ background: '#dee2e6', padding: 8 }}>
				Column 1
			</Grid.Col>
			<Grid.Col xs={6} style={{ background: '#adb5bd', padding: 8 }}>
				Column 2
			</Grid.Col>
		</Grid.Row>
	),
}

export const ColBreakpoints: Story = {
	render: () => (
		<Grid.Row>
			<Grid.Col xs={12} sm={8} md={6} lg={4} xl={3} xxl={2} style={{ background: '#dee2e6', padding: 8 }}>
				Responsive column (xs=12 → xxl=2)
			</Grid.Col>
		</Grid.Row>
	),
}

export const ColWithOffset: Story = {
	render: () => (
		<Grid.Row>
			<Grid.Col sm={{ span: 8, offset: 4 }} style={{ background: '#dee2e6', padding: 8 }}>
				sm span=8, offset=4
			</Grid.Col>
		</Grid.Row>
	),
}

export const ColDefault: Story = {
	render: () => (
		<Grid.Row>
			<Grid.Col style={{ background: '#dee2e6', padding: 8 }}>A column with no span fills the row</Grid.Col>
			<Grid.Col style={{ background: '#adb5bd', padding: 8 }}>…so these stack</Grid.Col>
		</Grid.Row>
	),
}

export const RowGutters: Story = {
	render: () => (
		<>
			<Grid.Row>
				<Grid.Col xs={6} style={{ background: '#dee2e6', padding: 8 }}>
					Default gutter (1.5rem)
				</Grid.Col>
				<Grid.Col xs={6} style={{ background: '#adb5bd', padding: 8 }}>
					Column 2
				</Grid.Col>
			</Grid.Row>
			<Grid.Row className="gap-2">
				<Grid.Col xs={6} style={{ background: '#dee2e6', padding: 8 }}>
					gap-2
				</Grid.Col>
				<Grid.Col xs={6} style={{ background: '#adb5bd', padding: 8 }}>
					Column 2
				</Grid.Col>
			</Grid.Row>
			<Grid.Row className="gap-x-0">
				<Grid.Col xs={6} style={{ background: '#dee2e6', padding: 8 }}>
					gap-x-0
				</Grid.Col>
				<Grid.Col xs={6} style={{ background: '#adb5bd', padding: 8 }}>
					Column 2
				</Grid.Col>
			</Grid.Row>
		</>
	),
}

export const RowWithFewerColumns: Story = {
	render: () => (
		<Grid.Row columns={5}>
			<Grid.Col xs={2} style={{ background: '#dee2e6', padding: 8 }}>
				2 of 5
			</Grid.Col>
			<Grid.Col xs={3} style={{ background: '#adb5bd', padding: 8 }}>
				3 of 5
			</Grid.Col>
		</Grid.Row>
	),
}

export const ContainerDefault: StoryObj<typeof Grid.Container> = {
	render: () => (
		<Grid.Container style={{ background: '#f8f9fa', padding: 16 }}>
			<Grid.Row>
				<Grid.Col xs={12} style={{ background: '#dee2e6', padding: 8 }}>
					Inside a container
				</Grid.Col>
			</Grid.Row>
		</Grid.Container>
	),
}

export const ContainerWithRow: Story = {
	render: () => (
		<Grid.Container>
			<Grid.Row>
				<Grid.Col xs={4} style={{ background: '#dee2e6', padding: 8 }}>
					Inside a container
				</Grid.Col>
				<Grid.Col xs={8} style={{ background: '#adb5bd', padding: 8 }}>
					Second column
				</Grid.Col>
			</Grid.Row>
		</Grid.Container>
	),
}
