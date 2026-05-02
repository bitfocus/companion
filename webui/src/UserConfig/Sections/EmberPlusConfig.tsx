import { observer } from 'mobx-react-lite'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigStaticTextRow } from '../Components/UserConfigStaticTextRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'

export const EmberPlusConfig = observer(function EmberPlusConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="Ember+" />

			<UserConfigSwitchRow userConfig={props} label="Ember+ Provider" field="emberplus_enabled" />

			{props.config.emberplus_enabled && (
				<UserConfigStaticTextRow label="Ember+ Listen Port" text={9092} textHelp="You can't change this value." />
			)}
		</>
	)
})
