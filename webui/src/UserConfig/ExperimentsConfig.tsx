import React from 'react'
import { CAlert } from '@coreui/react'
import CSwitch from '../CSwitch'
import type { UserConfigModel } from '@companion/shared/Model/UserConfigModel'

interface ExperimentsConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export function ExperimentsConfig({}: ExperimentsConfigProps) {
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
					<div className="form-check form-check-inline mr-1 float-right">
						<CSwitch
							color="success"
							checked={window.localStorage.getItem('test_touch_backend') === '1'}
							size={'lg'}
							onChange={(e) => {
								window.localStorage.setItem('test_touch_backend', e.currentTarget.checked ? '1' : '0')
								window.location.reload()
							}}
						/>
					</div>
				</td>
				<td>&nbsp;</td>
			</tr>
			<tr>
				<td>Companion Cloud Tab</td>
				<td>
					<div className="form-check form-check-inline mr-1 float-right">
						<CSwitch
							color="success"
							checked={window.localStorage.getItem('show_companion_cloud') === '1'}
							size={'lg'}
							onChange={(e) => {
								window.localStorage.setItem('show_companion_cloud', e.currentTarget.checked ? '1' : '0')
								window.location.reload()
							}}
						/>
					</div>
				</td>
				<td>&nbsp;</td>
			</tr>
		</>
	)
}
