import { observer } from 'mobx-react-lite'
import { InlineHelp } from '~/Components/InlineHelp.js'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigStaticTextRow } from '../Components/UserConfigStaticTextRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'

export const RosstalkConfig = observer(function RosstalkConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="RossTalk" />
			<UserConfigSwitchRow userConfig={props} label="RossTalk Listener" field="rosstalk_enabled" />

			{props.config.rosstalk_enabled && (
				<UserConfigStaticTextRow
					label={<InlineHelp help="You can't change this value.">Rosstalk Listen Port</InlineHelp>}
					text={7788}
				/>
			)}
		</>
	)
})
