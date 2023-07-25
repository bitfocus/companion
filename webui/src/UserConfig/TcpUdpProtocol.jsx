import React, { useContext } from 'react'
import { UserConfigContext } from '../util'

export function TcpUdpProtocol() {
	const config = useContext(UserConfigContext)

	return (
		<>
			<p>
				Remote triggering can be done by sending TCP (port{' '}
				<code>
					{config?.tcp_enabled && config?.tcp_listen_port && config?.tcp_listen_port !== '0'
						? config?.tcp_listen_port
						: 'disabled'}
				</code>
				) or UDP (port{' '}
				<code>
					{config?.udp_enabled && config?.udp_listen_port && config?.udp_listen_port !== '0'
						? config?.udp_listen_port
						: 'disabled'}
				</code>
				) commands.
			</p>
			<p>
				<strong>Commands:</strong>
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

			<p>
				<strong>Examples</strong>
			</p>

			<p>
				Set the emulator surface to page 23
				<br />
				<code>PAGE-SET 23 emulator</code>
			</p>

			<p>
				Press page 1 button 2
				<br />
				<code>BANK-PRESS 1 2</code>
			</p>

			<p>
				Change custom variable &quot;cue&quot; to value &quot;intro&quot;
				<br />
				<code>CUSTOM-VARIABLE cue SET-VALUE intro</code>
			</p>
		</>
	)
}
