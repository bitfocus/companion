import React from 'react'
import { observer } from 'mobx-react-lite'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'
import { UserConfigProps } from '../Components/Common.js'
import { UserConfigStaticTextRow } from '../Components/UserConfigStaticTextRow.js'
import { InlineHelp } from '../../Components/InlineHelp.js'

export const VideohubServerConfig = observer(function VideohubServerConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="Videohub Panel" />
			<UserConfigSwitchRow userConfig={props} label="Videohub Panel Listener" field="videohub_panel_enabled" />

			{props.config.videohub_panel_enabled && (
				<UserConfigStaticTextRow
					label={<InlineHelp help="You can't change this value.">Videohub Listen Port</InlineHelp>}
					text={9990}
				/>
			)}
		</>
	)
})
