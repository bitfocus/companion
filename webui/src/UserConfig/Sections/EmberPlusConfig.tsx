import { observer } from 'mobx-react-lite'
import { InlineHelp } from '~/Components/InlineHelp.js'
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
				<UserConfigStaticTextRow
					label={<InlineHelp help="You can't change this value.">Ember+ Listen Port</InlineHelp>}
					text={9092}
				/>
			)}
		</>
	)
})
