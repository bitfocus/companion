import React from 'react'
import { CButton, CFormSwitch } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { observer } from 'mobx-react-lite'

interface ButtonsConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export const ButtonsConfig = observer(function ButtonsConfig({ config, setValue, resetValue }: ButtonsConfigProps) {
	return (
		<>
			<tr>
				<th colSpan={3} className="settings-category">
					Buttons
				</th>
			</tr>

			<tr>
				<td>Flip counting direction on page up/down buttons</td>
				<td>
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.page_direction_flipped}
						size="xl"
						onChange={(e) => setValue('page_direction_flipped', e.currentTarget.checked)}
					/>
				</td>
				<td>
					<CButton onClick={() => resetValue('page_direction_flipped')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>

			<tr>
				<td>Show + and - instead of arrows on page up/down buttons</td>
				<td>
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.page_plusminus}
						size="xl"
						onChange={(e) => setValue('page_plusminus', e.currentTarget.checked)}
					/>
				</td>
				<td>
					<CButton onClick={() => resetValue('page_plusminus')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>

			<tr>
				<td>Show the topbar on each button. This can be overridden per-button</td>
				<td>
					<CFormSwitch
						className="float-right"
						color="success"
						checked={!config.remove_topbar}
						size="xl"
						onChange={(e) => setValue('remove_topbar', !e.currentTarget.checked)}
					/>
				</td>
				<td>
					<CButton onClick={() => resetValue('remove_topbar')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
		</>
	)
})
