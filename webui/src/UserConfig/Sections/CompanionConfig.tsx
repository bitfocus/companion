import React from 'react'
import { observer } from 'mobx-react-lite'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigTextInputRow } from '../Components/UserConfigTextInputRow.js'

export const CompanionConfig = observer(function CompanionConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="Installation Settings" />
			<UserConfigTextInputRow userConfig={props} label="Installation Name" field="installName" />
			<UserConfigTextInputRow
				userConfig={props}
				useVariables={true}
				label="Default Export File Name"
				field="default_export_filename"
			/>
		</>
	)
})
