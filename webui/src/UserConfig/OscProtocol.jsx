import React, { useContext } from 'react'
import { UserConfigContext } from '../util'

export function OscProtocol() {
	const config = useContext(UserConfigContext)

	return (
		<>
			<p>
				Remote triggering can be done by sending OSC commands to port{' '}
				<code>
					{config?.osc_enabled && config?.osc_listen_port && config?.osc_listen_port !== '0'
						? config?.osc_listen_port
						: 'disabled'}
				</code>
				.
			</p>
			<p>
				<strong>Commands:</strong>
			</p>
			<ul>
				<li>
					<code>/press/bank/</code>&lt;page&gt;<code>/</code>&lt;button&gt;
					<br />
					<i>Press and release a button (run both down and up actions)</i>
				</li>
				<li>
					<code>/press/bank/</code>&lt;page&gt;<code>/</code>&lt;button&gt; &lt;1&gt;
					<br />
					<i>Press the button (run down actions and hold)</i>
				</li>
				<li>
					<code>/press/bank/</code>&lt;page&gt;<code>/</code>&lt;button&gt; &lt;0&gt;
					<br />
					<i>Release the button (run up actions)</i>
				</li>
				<li>
					<code>/style/bgcolor/</code>&lt;page&gt;<code>/</code>&lt;button&gt; &lt;red 0-255&gt; &lt;green 0-255&gt;
					&lt;blue 0-255&gt;
					<br />
					<i>Change background color of button</i>
				</li>
				<li>
					<code>/style/color/</code>&lt;page&gt;<code>/</code>&lt;button&gt; &lt;red 0-255&gt; &lt;green 0-255&gt;
					&lt;blue 0-255&gt;
					<br />
					<i>Change color of text on button</i>
				</li>
				<li>
					<code>/style/text/</code>&lt;page&gt;<code>/</code>&lt;button&gt; &lt;text&gt;
					<br />
					<i>Change text on a button</i>
				</li>
				<li>
					<code>/custom-variable/</code>&lt;name&gt;<code>/value</code> &lt;value&gt;
					<br />
					<i>Change custom variable value</i>
				</li>
				<li>
					<code>/rescan</code> 1
					<br />
					<i>Make Companion rescan for newly attached USB surfaces</i>
				</li>
			</ul>

			<p>
				<strong>Examples</strong>
			</p>

			<p>
				Press button 5 on page 1 down and hold
				<br />
				<code>/press/bank/1/5 1</code>
			</p>

			<p>
				Change button background color of button 5 on page 1 to red
				<br />
				<code>/style/bgcolor/1/5 255 0 0</code>
			</p>

			<p>
				Change the text of button 5 on page 1 to ONLINE
				<br />
				<code>/style/text/1/5 ONLINE</code>
			</p>

			<p>
				Change custom variable &quot;cue&quot; to value &quot;intro&quot;
				<br />
				<code>/custom-variable/cue/value intro</code>
			</p>
		</>
	)
}
