import React, { useContext } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'

export const TcpUdpProtocol = observer(function TcpUdpProtocol() {
	const { userConfig } = useContext(RootAppStoreContext)

	const tcpPort =
		userConfig.properties?.tcp_enabled && userConfig.properties?.tcp_listen_port
			? userConfig.properties?.tcp_listen_port
			: 'disabled'
	const udpPort =
		userConfig.properties?.udp_enabled && userConfig.properties?.udp_listen_port
			? userConfig.properties?.udp_listen_port
			: 'disabled'

	return (
		<>
			<p>
				Remote triggering can be done by sending TCP (port <code>{tcpPort}</code>) or UDP (port <code>{udpPort}</code>)
				commands. TCP commands must be terminated with a newline character, i.e. \n (0x0A) or \r\n (0x0D, 0x0A).
			</p>
			<p>
				<strong>Commands:</strong>
			</p>
			<ul>
				<li>
					<code>SURFACE</code> &lt;surface id&gt; <code>PAGE-SET</code> &lt;page number&gt;
					<br />
					<i>Set a surface to a specific page</i>
				</li>
				<li>
					<code>SURFACE</code> &lt;surface id&gt; <code>PAGE-UP</code>
					<br />
					<i>Page up on a specific surface</i>
				</li>
				<li>
					<code>SURFACE</code> &lt;surface id&gt; <code>PAGE-DOWN</code>
					<br />
					<i>Page down on a specific surface</i>
				</li>

				<li>
					<code>LOCATION</code> &lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt; <code>PRESS</code>
					<br />
					<i>Press and release a button (run both down and up actions)</i>
				</li>
				<li>
					<code>LOCATION</code> &lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt; <code>DOWN</code>
					<br />
					<i>Press the button (run down actions)</i>
				</li>
				<li>
					<code>LOCATION</code> &lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt; <code>UP</code>
					<br />
					<i>Release the button (run up actions)</i>
				</li>
				<li>
					<code>LOCATION</code> &lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;{' '}
					<code>ROTATE-LEFT</code>
					<br />
					<i>Trigger a left rotation of the button/encode</i>
				</li>
				<li>
					<code>LOCATION</code> &lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;{' '}
					<code>ROTATE-RIGHT</code>
					<br />
					<i>Trigger a right rotation of the button/encode</i>
				</li>
				<li>
					<code>LOCATION</code> &lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt; <code>SET-STEP</code>{' '}
					&lt;step&gt;
					<br />
					<i>Set the current step of a button/encoder</i>
				</li>

				<li>
					<code>LOCATION</code> &lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;{' '}
					<code>STYLE TEXT</code> &lt;text&gt;
					<br />
					<i>Change text on a button</i>
				</li>
				<li>
					<code>LOCATION</code> &lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;{' '}
					<code>STYLE COLOR</code> &lt;color HEX&gt;
					<br />
					<i>Change text color on a button (#000000)</i>
				</li>
				<li>
					<code>LOCATION</code> &lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;{' '}
					<code>STYLE BGCOLOR</code> &lt;color HEX&gt;
					<br />
					<i>Change background color on a button (#000000)</i>
				</li>

				<li>
					<code>CUSTOM-VARIABLE</code> &lt;name&gt; <code>SET-VALUE</code> &lt;value&gt;
					<br />
					<i>Change custom variable value</i>
				</li>
				<li>
					<code>SURFACES RESCAN</code>
					<br />
					<i>Make Companion rescan for USB surfaces</i>
				</li>
			</ul>

			<p>
				<strong>Examples</strong>
			</p>

			<p>
				Set the emulator surface to page 23
				<br />
				<code>SURFACE emulator PAGE-SET 23</code>
			</p>

			<p>
				Press page 1 row 2 column 3
				<br />
				<code>LOCATION 1/2/3 PRESS</code>
			</p>

			<p>
				Change custom variable &quot;cue&quot; to value &quot;intro&quot;
				<br />
				<code>CUSTOM-VARIABLE cue SET-VALUE intro</code>
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
					<code>PAGE-SET</code> &lt;page number&gt; &lt;surface id&gt;
					<br />
					<i>Make device go to a specific page</i>
				</li>
				<li>
					<code>PAGE-UP</code> &lt;surface id&gt;
					<br />
					<i>Page up on a specific device</i>
				</li>
				<li>
					<code>PAGE-DOWN</code> &lt;surface id&gt;
					<br />
					<i>Page down on a specific surface</i>
				</li>
				<li>
					<code>BANK-PRESS</code> &lt;page&gt; &lt;button&gt;
					<br />
					<i>Press and release a button (run both down and up actions)</i>
				</li>
				<li>
					<code>BANK-DOWN</code> &lt;page&gt; &lt;button&gt;
					<br />
					<i>Press the button (run down actions)</i>
				</li>
				<li>
					<code>BANK-UP</code> &lt;page&gt; &lt;button&gt;
					<br />
					<i>Release the button (run up actions)</i>
				</li>
				<li>
					<code>STYLE BANK</code> &lt;page&gt; &lt;button&gt;<code> TEXT </code>
					&lt;text&gt;
					<br />
					<i>Change text on a button</i>
				</li>
				<li>
					<code>STYLE BANK</code> &lt;page&gt; &lt;button&gt;
					<code> COLOR </code>&lt;color HEX&gt;
					<br />
					<i>Change text color on a button (#000000)</i>
				</li>
				<li>
					<code>STYLE BANK</code> &lt;page&gt; &lt;button&gt;
					<code> BGCOLOR </code>&lt;color HEX&gt;
					<br />
					<i>Change background color on a button (#000000)</i>
				</li>
				<li>
					<code>CUSTOM-VARIABLE</code> &lt;name&gt; <code>SET-VALUE</code> &lt;value&gt;
					<br />
					<i>Change custom variable value</i>
				</li>
				<li>
					<code>RESCAN</code>
					<br />
					<i>Make Companion rescan for newly attached USB surfaces</i>
				</li>
			</ul>
		</>
	)
})
