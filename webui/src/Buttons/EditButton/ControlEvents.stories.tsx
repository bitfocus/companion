import type { Meta, StoryObj } from '@storybook/react'
import { useRef, useState } from 'react'
import { useArgs } from 'storybook/preview-api'
import { Button } from '~/Components/Button'
import { ActionSetControlEventsCheckbox } from './ActionSetControlEventsCheckbox'
import {
	EditDurationGroupPropertiesModal,
	type EditDurationGroupPropertiesModalRef,
} from './EditDurationGroupPropertiesModal'

const meta = {
	title: 'Buttons/Edit Button/Surface cue',
	component: ActionSetControlEventsCheckbox,
	args: {
		enabled: true,
		setEnabled: () => {},
	},
} satisfies Meta<typeof ActionSetControlEventsCheckbox>

export default meta
type Story = StoryObj<typeof meta>

export const OnOff: Story = {
	parameters: {
		docs: {
			description: {
				story:
					'Focused preference-control fixture. It does not render the complete press and release action-group headers.',
			},
		},
	},
	render: function Render() {
		const [{ enabled }, setArgs] = useArgs<{ enabled: boolean }>()

		return (
			<div>
				<ActionSetControlEventsCheckbox enabled={enabled} setEnabled={(value) => setArgs({ enabled: value })} />
				<p className="mt-2" aria-live="polite">
					Automatic surface cue: {enabled ? 'On' : 'Off'}
				</p>
			</div>
		)
	},
}

interface DurationGroupValues {
	duration: number
	whileHeld: boolean
	controlEvents: boolean
}

const initialDurationGroup: DurationGroupValues = {
	duration: 1000,
	whileHeld: false,
	controlEvents: true,
}

export const DurationGroupModal: Story = {
	parameters: {
		docs: {
			description: {
				story:
					'Exercises the real duration-group modal and displays the values returned by Save. It does not include the full action editor or runtime stores.',
			},
		},
	},
	render: function Render() {
		const modalRef = useRef<EditDurationGroupPropertiesModalRef | null>(null)
		const [values, setValues] = useState(initialDurationGroup)
		const [lastSave, setLastSave] = useState<DurationGroupValues | null>(null)

		const openModal = () => {
			modalRef.current?.show(
				values.duration,
				values.whileHeld,
				values.controlEvents,
				(duration, whileHeld, controlEvents) => {
					const savedValues = { duration, whileHeld, controlEvents }
					setValues(savedValues)
					setLastSave(savedValues)
				}
			)
		}

		return (
			<div>
				<Button color="primary" onClick={openModal}>
					Open duration group properties
				</Button>
				<p className="mt-2 font-mono" aria-live="polite">
					{lastSave
						? `Last save: duration=${lastSave.duration}ms, whileHeld=${lastSave.whileHeld}, controlEvents=${lastSave.controlEvents}`
						: 'Last save: none'}
				</p>
				<EditDurationGroupPropertiesModal ref={modalRef} />
			</div>
		)
	},
}
