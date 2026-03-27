import React from 'react'
import { observer } from 'mobx-react-lite'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'

export const ButtonsConfig = observer(function ButtonsConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow
				label="Buttons"
				children="Setup button appearances."
				helpAction="/user-guide/config/settings#buttons"
			/>

			<UserConfigSwitchRow
				userConfig={props}
				label="Flip counting direction on page up/down buttons"
				field="page_direction_flipped"
			/>

			<UserConfigSwitchRow
				userConfig={props}
				label="Show + and - instead of arrows on page up/down buttons"
				field="page_plusminus"
			/>

			<UserConfigSwitchRow
				userConfig={props}
				label="Show the topbar on each button. This can be overridden per-button"
				field="remove_topbar"
				inverted
			/>
		</>
	)
})
