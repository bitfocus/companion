import { CheckboxInputFieldWithLabel } from '~/Components/CheckboxInputField.js'
import { SURFACE_CUE_TOOLTIP } from './SurfaceCueText.js'

interface ActionSetControlEventsCheckboxProps {
	enabled: boolean
	setEnabled: (enabled: boolean) => void
}

export function ActionSetControlEventsCheckbox({
	enabled,
	setEnabled,
}: ActionSetControlEventsCheckboxProps): React.JSX.Element {
	return (
		<CheckboxInputFieldWithLabel
			className="me-2 flex items-center"
			label="Surface cue"
			tooltip={SURFACE_CUE_TOOLTIP}
			value={enabled}
			setValue={(value) => setEnabled(value)}
		/>
	)
}
