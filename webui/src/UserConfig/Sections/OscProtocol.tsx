import React, { useContext } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'

export const OscProtocol = observer(function OscProtocol() {
	const { userConfig } = useContext(RootAppStoreContext)

	return (
		<>
			<p>
				Remote triggering can be done by sending OSC commands to port{' '}
				<code>
					{userConfig.properties?.osc_enabled && userConfig.properties?.osc_listen_port
						? userConfig.properties?.osc_listen_port
						: 'disabled'}
				</code>
				.
			</p>
			<p>
				<strong>Commands:</strong>
			</p>
			<ul>
				<li>
					<code>/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;<code>/press</code>
					<br />
					<i>Press and release a button (run both down and up actions)</i>
				</li>
				<li>
					<code>/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;<code>/down</code>
					<br />
					<i>Press the button (run down actions and hold)</i>
				</li>
				<li>
					<code>/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;<code>/up</code>
					<br />
					<i>Release the button (run up actions)</i>
				</li>
				<li>
					<code>/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;
					<code>/rotate-left</code>
					<br />
					<i>Trigger a left rotation of the button/encoder</i>
				</li>
				<li>
					<code>/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;
					<code>/rotate-right</code>
					<br />
					<i>Trigger a right rotation of the button/encoder</i>
				</li>
				<li>
					<code>/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;
					<code>/step</code>
					<br />
					<i>Set the current step of a button/encoder</i>
				</li>

				<li>
					<code>/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;
					<code>/style/bgcolor</code> &lt;red 0-255&gt; &lt;green 0-255&gt; &lt;blue 0-255&gt;
					<br />
					<i>Change background color of button</i>
				</li>
				<li>
					<code>/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;
					<code>/style/bgcolor</code> &lt;css color&gt;
					<br />
					<i>Change background color of button</i>
				</li>
				<li>
					<code>/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;
					<code>/style/color</code> &lt;red 0-255&gt; &lt;green 0-255&gt; &lt;blue 0-255&gt;
					<br />
					<i>Change color of text on button</i>
				</li>
				<li>
					<code>/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;
					<code>/style/color</code> &lt;css color&gt;
					<br />
					<i>Change color of text on button</i>
				</li>
				<li>
					<code>/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;
					<code>/style/text</code> &lt;text&gt;
					<br />
					<i>Change text on a button</i>
				</li>

				<li>
					<code>/custom-variable/</code>&lt;name&gt;<code>/value</code> &lt;value&gt;
					<br />
					<i>Change custom variable value</i>
				</li>
				<li>
					<code>/surfaces/rescan</code>
					<br />
					<i>Make Companion rescan for newly attached USB surfaces</i>
				</li>
			</ul>

			<p>
				<strong>Examples</strong>
			</p>

			<p>
				Press row 0, column 5 on page 1 down and hold
				<br />
				<code>/location/1/0/5/press</code>
			</p>

			<p>
				Change button background color of row 0, column 5 on page 1 to red
				<br />
				<code>/location/1/0/5/style/bgcolor 255 0 0</code>
				<br />
				<code>/location/1/0/5/style/bgcolor rgb(255,0,0)</code>
				<br />
				<code>/location/1/0/5/style/bgcolor #ff0000</code>
			</p>

			<p>
				Change the text of row 0, column 5 on page 1 to ONLINE
				<br />
				<code>/location/1/0/5/style/text ONLINE</code>
			</p>

			<p>
				Change custom variable &quot;cue&quot; to value &quot;intro&quot;
				<br />
				<code>/custom-variable/cue/value intro</code>
			</p>

			<p>
				<strong>Deprecated Commands:</strong>
			</p>
			<p>
				The following commands are deprecated and have replacements listed above. They will be removed in a future
				version of Companion.
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
					<code>/rescan</code> 1
					<br />
					<i>Make Companion rescan for newly attached USB surfaces</i>
				</li>
			</ul>
		</>
	)
})
