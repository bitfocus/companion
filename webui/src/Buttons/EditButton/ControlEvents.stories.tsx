import type { Meta, StoryObj } from '@storybook/react'
import { useRef, useState } from 'react'
import { useArgs } from 'storybook/preview-api'
import { Button } from '~/Components/Button'
import { ActionSetPropertiesButton } from './ActionSetPropertiesButton'
import {
	EditDurationGroupPropertiesModal,
	type EditDurationGroupPropertiesModalRef,
} from './EditDurationGroupPropertiesModal'

const meta = {
	title: 'Buttons/Edit Button/Surface cue',
	component: ActionSetPropertiesButton,
	args: {
		controlEvents: true,
		setControlEvents: () => {},
	},
} satisfies Meta<typeof ActionSetPropertiesButton>

export default meta
type Story = StoryObj<typeof meta>

export const PressOrReleaseGroup: Story = {
	parameters: {
		docs: {
			description: {
				story:
					'The Configure button on the press and release groups, with its cut back properties modal. It does not render the complete action group headers.',
			},
		},
	},
	render: function Render() {
		const [{ controlEvents }, setArgs] = useArgs<{ controlEvents: boolean }>()

		return (
			<div>
				<ActionSetPropertiesButton
					controlEvents={controlEvents}
					setControlEvents={(value) => setArgs({ controlEvents: value })}
				/>
				<p className="mt-2" aria-live="polite">
					Automatic surface cue: {controlEvents ? 'On' : 'Off'}
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
