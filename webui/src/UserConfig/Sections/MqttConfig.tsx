import React from 'react'
import { observer } from 'mobx-react-lite'
import { UserConfigProps } from '../Components/Common.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigNumberInputRow } from '../Components/UserConfigNumberInputRow.js'
import { UserConfigTextInputRow } from '../Components/UserConfigTextInputRow.js'

export const MqttConfig = observer(function MqttConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="MQTT" />
			<UserConfigSwitchRow userConfig={props} label="MQTT Service" field="mqtt_enabled" />

			{props.config.mqtt_enabled && (
				<>
					<UserConfigTextInputRow
						userConfig={props}
						label="MQTT Broker Host"
						field="mqtt_broker"
					/>
					<UserConfigNumberInputRow
						userConfig={props}
						label="MQTT Port"
						field="mqtt_port"
						min={1}
						max={65535}
					/>
					<UserConfigTextInputRow
						userConfig={props}
						label="Username"
						field="mqtt_username"
					/>
					<UserConfigTextInputRow
						userConfig={props}
						label="Password"
						field="mqtt_password"
					/>
					<UserConfigTextInputRow
						userConfig={props}
						label="Topic Prefix"
						field="mqtt_topic"
					/>
				</>
			)}
		</>
	)
})
