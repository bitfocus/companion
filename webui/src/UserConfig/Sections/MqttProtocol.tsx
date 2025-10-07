import React, { useContext } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'

export const MqttProtocol = observer(function MqttProtocol() {
	const { userConfig } = useContext(RootAppStoreContext)

	return (
		<>
			<p>
				Currently the MQTT service only supports publishing instance variables to your MQTT broker.
			</p>
			<p>Variables are published to the topic <code>{userConfig.properties?.mqtt_topic ? userConfig.properties.mqtt_topic + '/variables/<connection>/<variable>': 'disabled'}</code>.</p>
		</>
	)
})
