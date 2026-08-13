import type { Meta, StoryObj } from '@storybook/react'
import { FormLabel } from './Form'
import { Grid } from './Grid'

const meta = {
	component: FormLabel,
	parameters: {
		layout: 'padded',
	},
	// htmlFor is a required prop; the stories below use custom render() and set it per-label
	args: {
		htmlFor: undefined,
	},
} satisfies Meta<typeof FormLabel>

export default meta
type Story = StoryObj<typeof meta>

const SampleInput = ({ id }: { id: string }) => (
	<input id={id} type="text" className="form-input text-input-field" defaultValue="Some value" />
)

// A plain label above its field (no column/grid props)
export const Plain: Story = {
	render: () => (
		<div>
			<FormLabel htmlFor="plain">Surface name</FormLabel>
			<SampleInput id="plain" />
		</div>
	),
}

// The common horizontal form row: a column-aligned label (column="sm") beside its input.
// The label's vertical padding lines its text up with the adjacent input.
export const ColumnRow: Story = {
	render: () => (
		<Grid.Row>
			<FormLabel htmlFor="col-sm" sm={4} column="sm">
				Surface name
			</FormLabel>
			<Grid.Col sm={8}>
				<SampleInput id="col-sm" />
			</Grid.Col>
		</Grid.Row>
	),
}

// column sizes: base, sm and lg change the label's padding/font to match the input size
export const ColumnSizes: Story = {
	render: () => (
		<>
			<Grid.Row className="mb-2">
				<FormLabel htmlFor="c-base" sm={4} column>
					column (base)
				</FormLabel>
				<Grid.Col sm={8}>
					<SampleInput id="c-base" />
				</Grid.Col>
			</Grid.Row>
			<Grid.Row className="mb-2">
				<FormLabel htmlFor="c-sm" sm={4} column="sm">
					column="sm"
				</FormLabel>
				<Grid.Col sm={8}>
					<SampleInput id="c-sm" />
				</Grid.Col>
			</Grid.Row>
			<Grid.Row>
				<FormLabel htmlFor="c-lg" sm={4} column="lg">
					column="lg"
				</FormLabel>
				<Grid.Col sm={8}>
					<SampleInput id="c-lg" />
				</Grid.Col>
			</Grid.Row>
		</>
	),
}

// Grid sizing mirrors Grid.Col — including the object form for offsets
export const WithOffset: Story = {
	render: () => (
		<Grid.Row>
			<FormLabel htmlFor="offset" sm={{ span: 4, offset: 1 }} column="sm">
				Offset label
			</FormLabel>
			<Grid.Col sm={7}>
				<SampleInput id="offset" />
			</Grid.Col>
		</Grid.Row>
	),
}
