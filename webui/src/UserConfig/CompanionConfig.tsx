import React from 'react'
import { CButton, CInput } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { observer } from 'mobx-react-lite'

interface CompanionConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export const CompanionConfig = observer(function CompanionConfig({
	config,
	setValue,
	resetValue,
}: CompanionConfigProps) {
	return (
		<>
			<tr>
				<th colSpan={3} className="settings-category">
					Installation Name
				</th>
			</tr>
			<tr>
				<td>
					<div className="form-check form-check-inline mr-1">
						<CInput
							type="text"
							value={config.installName}
							onChange={(e) => setValue('installName', e.currentTarget.value)}
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
					<CButton onClick={() => resetValue('installName')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
		</>
	)
})
