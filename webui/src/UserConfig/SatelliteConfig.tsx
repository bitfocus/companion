import React from 'react'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { observer } from 'mobx-react-lite'
import { InlineHelp } from '../Components/InlineHelp.js'

interface SatelliteConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export const SatelliteConfig = observer(function SatelliteConfig({}: SatelliteConfigProps) {
	return (
		<>
			<tr>
				<th colSpan={3} className="settings-category">
					Satellite
				</th>
			</tr>
			<tr>
				<td>
					<InlineHelp help="You can't change this value.">Satellite Listen Port</InlineHelp>
				</td>
				<td colSpan={2} style={{ textAlign: 'center', fontSize: 17, color: '#555', padding: 13 }}>
					16622
				</td>
			</tr>
		</>
	)
})
