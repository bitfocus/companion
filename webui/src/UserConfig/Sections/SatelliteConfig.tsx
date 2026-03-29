import React from 'react'
import { CAlert } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import { InlineHelp } from '~/Components/InlineHelp.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigStaticTextRow } from '../Components/UserConfigStaticTextRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'

export const SatelliteConfig = observer(function SatelliteConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="Satellite" />

			<UserConfigStaticTextRow
				label={<InlineHelp help="You can't change this value.">Satellite TCP Listen Port</InlineHelp>}
				text={16622}
			/>

			<UserConfigStaticTextRow
				label={<InlineHelp help="You can't change this value.">Satellite Websocket Listen Port</InlineHelp>}
				text={16623}
			/>

			<UserConfigSwitchRow
				userConfig={props}
				label="Enable Button Subscriptions API"
				field="satellite_subscriptions_enabled"
			/>

			<tr>
				<td colSpan={3}>
					<CAlert color="warning">
						The Subscriptions API is required for full functionality from the Elgato plugin, but enabling it allows any
						satellite client to bypass the pincode/page system and interact with any button within Companion
					</CAlert>
				</td>
			</tr>
		</>
	)
})
