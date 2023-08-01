import React from 'react'

export function SatelliteConfig({ config, setValue, resetValue }) {
	return (
		<>
			<tr>
				<th colSpan="3" className="settings-category">
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
