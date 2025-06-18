import React from 'react'
import { UserConfigProps } from './Common.js'
import { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { UserConfigNumberInputRow } from './UserConfigNumberInputRow.js'

interface UserConfigPortNumberRowProps {
	userConfig: UserConfigProps
	label: string | React.ReactNode
	field: keyof UserConfigModel
}
export function UserConfigPortNumberRow(props: UserConfigPortNumberRowProps): React.JSX.Element {
	return <UserConfigNumberInputRow {...props} min={1024} max={65535} step={1} />
}
