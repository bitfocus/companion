import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import '~/Controls/Components/EntityList.css'
import { EditorRow } from './EditorRow'

interface ExampleRowProps {
	badge: string | null
	title: string
	initialHeadline: string
	canCollapse: boolean
	readonly: boolean
}

function ExampleRow({ badge, title, initialHeadline, canCollapse, readonly }: ExampleRowProps): React.JSX.Element {
	const [isCollapsed, setCollapsed] = useState(false)
	const [enabled, setEnabled] = useState(true)
	const [headline, setHeadline] = useState(initialHeadline)
	const [editing, setEditing] = useState(false)

	const toggleCollapsed = () => {
		setEditing(false)
		setCollapsed(!isCollapsed)
	}
	const collapsed = canCollapse && isCollapsed

	return (
		<div className="entity-list max-w-2xl">
			<EditorRow.Root rowRef={() => {}} dragRef={() => {}} disabled={!enabled} isDragging={false}>
				<EditorRow.Header
					onToggleCollapsed={canCollapse ? toggleCollapsed : null}
					controls={
						<>
							{!editing && !collapsed && (
								<EditorRow.NoteButton
									itemLabel="action"
									hasNote={!!headline}
									disabled={readonly}
									onClick={() => setEditing(true)}
								/>
							)}
							<EditorRow.DuplicateButton itemLabel="action" disabled={readonly} onClick={() => {}} />
							<EditorRow.RemoveButton itemLabel="action" disabled={readonly} onClick={() => {}} />
							<EditorRow.EnabledSwitch itemLabel="action" enabled={enabled} setEnabled={setEnabled} />
							{canCollapse && (
								<EditorRow.CollapseButton itemLabel="action" isCollapsed={collapsed} onClick={toggleCollapsed} />
							)}
						</>
					}
				>
					{badge && <EditorRow.Badge>{badge}</EditorRow.Badge>}
					<div className="flex flex-col flex-1 min-w-0 gap-0.5">
						<EditorRow.Title isCollapsed={collapsed}>{title}</EditorRow.Title>
						<EditorRow.Headline
							headline={headline}
							setHeadline={setHeadline}
							editing={editing}
							setEditing={setEditing}
							placeholder="Describe the intent of the action"
							isCollapsed={collapsed}
							readonly={readonly}
						/>
					</div>
				</EditorRow.Header>

				{!collapsed && <div className="editor-grid">What the action is edited with</div>}
			</EditorRow.Root>
		</div>
	)
}

const meta = {
	title: 'Components/EditorRow',
	component: ExampleRow,
	args: {
		badge: 'Internal',
		title: 'Set a custom variable value',
		initialHeadline: 'Count the presses',
		canCollapse: true,
		readonly: false,
	},
} satisfies Meta<typeof ExampleRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** No badge or note, as for the events of a trigger */
export const Plain: Story = {
	args: { badge: null, initialHeadline: '' },
}

/** Nothing to edit below the header, so it can't be collapsed */
export const NotCollapsible: Story = {
	args: { canCollapse: false },
}

export const Readonly: Story = {
	args: { readonly: true },
}
