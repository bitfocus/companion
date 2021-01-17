import { useEffect, useCallback } from 'react'
import { CInputCheckbox } from '@coreui/react'

export function CheckboxInputField({ definition, value, setValue }) {
	// If the value is undefined, populate with the default. Also inform the parent about the validity
	useEffect(() => {
		if (value === undefined && definition.default !== undefined) {
			setValue(definition.default, true)
		} else {
			setValue(value, true)
		}
	}, [definition.default, value, setValue])

	const onChange = useCallback((e) => {
		setValue(!!e.currentTarget.checked, true)
	}, [setValue])

	return <CInputCheckbox
		type='checkbox'
		checked={!!value}
		value={true}
		title={definition.tooltip}
		onChange={onChange}
	/>
}
