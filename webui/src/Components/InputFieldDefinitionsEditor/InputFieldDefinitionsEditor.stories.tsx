import { DragDropProvider } from '@dnd-kit/react'
import type { Decorator, Meta, StoryObj } from '@storybook/react'
import { useMemo, useState } from 'react'
import type { AuthorableInputField } from '@companion-app/shared/Model/Options.js'
import { withMockStore } from '../../../.storybook/mockRootAppStore.js'
import { MenuPortalContext } from '../MenuPortalContext.js'
import { InputFieldDefinitionsEditor, type InputFieldDefinitionsService } from './InputFieldDefinitionsEditor.js'

const withPortal: Decorator = (Story) => (
	<MenuPortalContext.Provider value={document.body}>
		<div className="p-4 max-w-2xl">
			<Story />
		</div>
	</MenuPortalContext.Provider>
)

function StatefulEditor({
	initialFields,
	readonly,
}: {
	initialFields: AuthorableInputField[]
	readonly: boolean
}): React.JSX.Element {
	const [fields, setFields] = useState(initialFields)

	const service = useMemo(
		(): InputFieldDefinitionsService => ({
			addField: (field) => setFields((fields) => [...fields, field]),
			removeField: (fieldId) => setFields((fields) => fields.filter((field) => field.id !== fieldId)),
			moveField: (fieldId, target) =>
				setFields((fields) => {
					const index = fields.findIndex((field) => field.id === fieldId)
					if (index === -1) return fields
					const updated = [...fields]
					const [moved] = updated.splice(index, 1)
					updated.splice(target, 0, moved)
					return updated
				}),
			updateField: (fieldId, newField) =>
				setFields((fields) => fields.map((field) => (field.id === fieldId ? newField : field))),
		}),
		[]
	)

	return (
		<>
			<DragDropProvider>
				<InputFieldDefinitionsEditor
					heading="Inputs"
					subheading={null}
					headingActions={null}
					fields={fields}
					service={service}
					readonly={readonly}
					localVariablesStore={null}
					collapseStorageId="storybook_input_fields"
				/>
			</DragDropProvider>
			<pre className="mt-4 text-2xs">{JSON.stringify(fields, null, 2)}</pre>
		</>
	)
}

const meta = {
	title: 'Components/InputFieldDefinitionsEditor',
	decorators: [withMockStore, withPortal],
	render: (args) => <StatefulEditor {...args} />,
} satisfies Meta<typeof StatefulEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
	args: {
		initialFields: [],
		readonly: false,
	},
}

export const SomeInputs: Story = {
	args: {
		initialFields: [
			{ type: 'number', id: 'input', label: 'Input', default: 1, min: 1, max: 20, asInteger: true },
			{
				type: 'dropdown',
				id: 'position',
				label: 'Position',
				default: 'left',
				choices: [
					{ id: 'left', label: 'Left' },
					{ id: 'right', label: 'Right' },
				],
			},
			{ type: 'checkbox', id: 'auto', label: 'Auto transition', default: true },
		],
		readonly: false,
	},
}

export const Readonly: Story = {
	args: {
		initialFields: [{ type: 'textinput', id: 'name', label: 'Name', default: 'Camera 1' }],
		readonly: true,
	},
}
