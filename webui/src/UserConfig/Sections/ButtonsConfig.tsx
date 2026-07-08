import { observer } from 'mobx-react-lite'
import { BUTTON_DECORATION_CHOICES } from '../ButtonAppearanceChoices.js'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigDropdownRow } from '../Components/UserConfigDropdownRow.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'
import { UserConfigSwitchValueRow } from '../Components/UserConfigSwitchValueRow.js'

export const ButtonsConfig = observer(function ButtonsConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow
				label="Buttons"
				helpMessage="Setup button appearances."
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

			<UserConfigDropdownRow
				userConfig={props}
				label="Default decoration to show on each button. This can be overridden per-button"
				field="buttons_decoration"
				choices={BUTTON_DECORATION_CHOICES}
			/>

			<UserConfigSwitchValueRow
				userConfig={props}
				label="Show the status icons on each button. This can be overridden per-button"
				field="buttons_status_icons"
				activeValue="show"
				inactiveValue="none"
			/>
		</>
	)
})
