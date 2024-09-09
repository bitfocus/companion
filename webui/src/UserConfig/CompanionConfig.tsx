import React from 'react'
import { observer } from 'mobx-react-lite'
import { UserConfigHeadingRow } from './Components/UserConfigHeadingRow.js'
import { ResetButton, UserConfigProps } from './Components/Common.js'
import { TextInputField } from '../Components/TextInputField.js'

export const CompanionConfig = observer(function CompanionConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="Installation Name" />

			<tr>
				<td>
					<div className="mr-1">
						<TextInputField
							value={String(props.config.installName)}
							setValue={(value) => props.setValue('installName', value)}
						/>
					</div>
				</td>
				<td>
					<div
						style={{
							minWidth: '8em', // provide minimum width for second column
						}}
					></div>
				</td>
				<td>
					<ResetButton userConfig={props} field="installName" />
				</td>
			</tr>
		</>
	)
})
