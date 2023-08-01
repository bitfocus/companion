import React, { useContext } from 'react'
import { UserConfigContext } from '../util'

export function RosstalkProtocol() {
	const config = useContext(UserConfigContext)

	return (
		<>
			<p>
				Remote triggering can be done by sending RossTalk commands to port{' '}
				<code>{config?.rosstalk_enabled ? '7788' : 'disabled'}</code>.
			</p>
			<p>
				<strong>Commands:</strong>
			</p>
			<ul>
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
				Press and release button 5 on page 2
				<br />
				<code>CC 2:5</code>
			</p>
		</>
	)
}
