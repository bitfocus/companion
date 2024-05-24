import React from 'react'
import { CAlert, CFormSwitch } from '@coreui/react'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { observer } from 'mobx-react-lite'

interface ExperimentsConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export const ExperimentsConfig = observer(function ExperimentsConfig({}: ExperimentsConfigProps) {
	return (
		<>
			<tr>
				<th colSpan={3} className="settings-category">
					Experiments
				</th>
			</tr>
			<tr>
				<td colSpan={3}>
					<CAlert color="danger">Do not touch these settings unless you know what you are doing!</CAlert>
				</td>
			</tr>
			<tr>
				<td>Use TouchBackend for Drag and Drop</td>
				<td>
					<CFormSwitch
						className="float-right"
						color="success"
						checked={window.localStorage.getItem('test_touch_backend') === '1'}
						size="xl"
						onChange={(e) => {
							window.localStorage.setItem('test_touch_backend', e.currentTarget.checked ? '1' : '0')
							window.location.reload()
						}}
					/>
				</td>
				<td>&nbsp;</td>
			</tr>
			<tr>
				<td>Companion Cloud Tab</td>
				<td>
					<CFormSwitch
						className="float-right"
						color="success"
						checked={window.localStorage.getItem('show_companion_cloud') === '1'}
						size="xl"
						onChange={(e) => {
							window.localStorage.setItem('show_companion_cloud', e.currentTarget.checked ? '1' : '0')
							window.location.reload()
						}}
					/>
				</td>
				<td>&nbsp;</td>
			</tr>
		</>
	)
})
