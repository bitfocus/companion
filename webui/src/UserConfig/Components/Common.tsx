import { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { CButton } from '@coreui/react'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'

export interface UserConfigProps {
	config: UserConfigModel

	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

interface ResetButtonProps {
	userConfig: UserConfigProps
	field: keyof UserConfigModel
}

export function ResetButton({ userConfig, field }: ResetButtonProps): React.JSX.Element {
	return (
		<CButton onClick={() => userConfig.resetValue(field)} title="Reset to default">
			<FontAwesomeIcon icon={faUndo} />
		</CButton>
	)
}
