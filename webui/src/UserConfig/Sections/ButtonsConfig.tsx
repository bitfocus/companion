import React from 'react'
import { observer } from 'mobx-react-lite'
import { UserConfigProps } from '../Components/Common.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'

export const ButtonsConfig = observer(function ButtonsConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="Buttons" />

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
