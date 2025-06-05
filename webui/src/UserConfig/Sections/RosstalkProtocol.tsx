import React, { useContext } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'

export const RosstalkProtocol = observer(function RosstalkProtocol() {
	const { userConfig } = useContext(RootAppStoreContext)

	return (
		<>
			<p>
				Remote triggering can be done by sending RossTalk commands to port{' '}
				<code>{userConfig.properties?.rosstalk_enabled ? '7788' : 'disabled'}</code>.
			</p>
			<p>
				<strong>Commands:</strong>
			</p>
			<ul>
				<li>
					<code>CC</code> &lt;page&gt;/&lt;row&gt;/&lt;column&gt;
					<br />
					<i>Press and release button</i>
				</li>
				<li>
					<code>CC</code> &lt;page&gt;:&lt;button&gt;
					<br />
					<i>Press and release button</i>
				</li>
			</ul>

			<p>
				<strong>Examples</strong>
			</p>

			<p>
				Press and release row 3, column 1 on page 2
				<br />
				<code>CC 2/3/1</code>
			</p>
			<p>
				Press and release button 5 on page 2
				<br />
				<code>CC 2:5</code>
			</p>
		</>
	)
})
