import React from 'react'
import type { UserConfigModel } from '@companion/shared/Model/UserConfigModel'

interface SatelliteConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export function SatelliteConfig({}: SatelliteConfigProps) {
	return (
		<>
			<tr>
				<th colSpan={3} className="settings-category">
					Satellite
				</th>
			</tr>
			<tr>
				<td>Satellite Listen Port</td>
				<td>16622</td>
				<td></td>
			</tr>
		</>
	)
}
