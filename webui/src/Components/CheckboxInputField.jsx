import { useEffect, useCallback } from 'react'
import { CInputCheckbox } from '@coreui/react'

export function CheckboxInputField({ definition, value, setValue, setValid, disabled }) {
	// If the value is undefined, populate with the default. Also inform the parent about the validity
	useEffect(() => {
		setValid?.(true)
	}, [setValid])

	const onChange = useCallback(
		(e) => {
			setValue(!!e.currentTarget.checked)
			setValid?.(true)
		},
		[setValue, setValid]
	)

	return (
		<CInputCheckbox
			type="checkbox"
			disabled={disabled}
			checked={!!value}
			value={true}
			title={definition.tooltip}
			onChange={onChange}
		/>
	)
}
