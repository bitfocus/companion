import React from 'react'
import { observer } from 'mobx-react-lite'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'
import { UserConfigNumberInputRow } from '../Components/UserConfigNumberInputRow.js'

export const ArtnetConfig = observer(function ArtnetConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="Artnet II Listener" />

			<UserConfigSwitchRow userConfig={props} label="Artnet Listener" field="artnet_enabled" />

			{props.config.artnet_enabled && (
				<>
					<UserConfigNumberInputRow
						userConfig={props}
						label="Artnet Universe (first is 0)"
						field="artnet_universe"
						min={0}
						max={20055}
					/>

					<UserConfigNumberInputRow
						userConfig={props}
						label="Artnet Channel"
						field="artnet_channel"
						min={1}
						max={509}
					/>
				</>
			)}
		</>
	)
})
