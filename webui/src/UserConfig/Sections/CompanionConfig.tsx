import { observer } from 'mobx-react-lite'
import { TIMEZONE_CHOICES } from '~/Resources/timezones.js'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigDropdownRow } from '../Components/UserConfigDropdownRow.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'
import { UserConfigTextInputRow } from '../Components/UserConfigTextInputRow.js'

export const CompanionConfig = observer(function CompanionConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="Installation Settings" helpAction="/user-guide/config/settings#general" />
			<UserConfigTextInputRow userConfig={props} label="Installation Name" field="installName" />
			<UserConfigSwitchRow
				userConfig={props}
				label="Announce Companion on the network (mDNS/Bonjour)"
				field="mdns_announcements_enabled"
			/>
			<UserConfigTextInputRow
				userConfig={props}
				useVariables={true}
				label="Default Export File Name"
				field="default_export_filename"
			/>
			<UserConfigDropdownRow
				userConfig={props}
				label="Timezone for time variables and triggers"
				field="timezone"
				choices={TIMEZONE_CHOICES}
				searchLabelsOnly
			/>
		</>
	)
})
