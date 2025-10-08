import React, { useContext } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'

export const MqttProtocol = observer(function MqttProtocol() {
	const { userConfig } = useContext(RootAppStoreContext)

	return (
		<>
			<p>
				The MQTT protocol is currently <b>experimental</b>.
			</p>
			<p>
				<b>Reading Data</b>
			</p>
			<p>
				Variables are published to the topic <code>{userConfig.properties?.mqtt_topic}/variables/</code>
				&lt;connection&gt;<code>/</code>&lt;variable&gt;.
			</p>
			<p>
				<b>Controlling Companion</b>
			</p>
			<p>The following commands are supported by publishing a message to the listed topics:</p>
			<ul>
				<li>
					Press and release a button (run both down and up actions):
					<br />
					Topic: <code>{userConfig.properties?.mqtt_topic}/commands/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/press</code>
				</li>
				<li>
					Press the button (run down actions and hold):
					<br />
					Topic: <code>{userConfig.properties?.mqtt_topic}/commands/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/down</code>
				</li>
				<li>
					Release the button (run up actions):
					<br />
					Topic: <code>{userConfig.properties?.mqtt_topic}/commands/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/up</code>
				</li>
				<li>
					Set a custom variable:
					<br />
					Topic: <code>{userConfig.properties?.mqtt_topic}/commands/custom-variable/</code>&lt;variable&gt;<code>/value</code>
					<br />
					Message: The value to set the variable to.
				</li>
			</ul>
		</>
	)
})
