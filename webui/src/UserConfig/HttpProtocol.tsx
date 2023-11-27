import React from 'react'

export function HttpProtocol() {
	return (
		<>
			<p>Remote triggering can be done by sending HTTP Requests to the same IP and port Companion is running on.</p>
			<p>
				<strong>Commands:</strong>
			</p>
			<p>
				This API tries to follow REST principles, and the convention that a <code>POST</code> request will modify a
				value, and a <code>GET</code> request will retrieve values.
			</p>
			<ul>
				<li>
					Press and release a button (run both down and up actions)
					<br />
					Method: <code>POST</code>
					<br />
					Path: <code>/api/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;
					<code>/press</code>
				</li>
				<li>
					Press the button (run down actions and hold)
					<br />
					Method: <code>POST</code>
					<br />
					Path: <code>/api/location/</code>&lt;page&gt;<code>/</code>
					&lt;row&gt;<code>/</code>&lt;column&gt;
					<code>/down</code>
				</li>
				<li>
					Release the button (run up actions)
					<br />
					Method: <code>POST</code>
					<br />
					Path: <code>/api/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;
					<code>/up</code>
				</li>
				<li>
					Trigger a left rotation of the button/encoder
					<br />
					Method: <code>POST</code>
					<br />
					Path: <code>/api/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;
					<code>/rotate-left</code>
				</li>
				<li>
					Trigger a right rotation of the button/encoder
					<br />
					Method: <code>POST</code>
					<br />
					Path: <code>/api/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;
					<code>/rotate-right</code>
				</li>
				<li>
					Set the current step of a button/encoder
					<br />
					Method: <code>POST</code>
					<br />
					Path: <code>/api/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;
					<code>/step?step=&lt;step&gt;</code>
				</li>

				<br />

				<li>
					<code>/style/bank/</code>&lt;page&gt;<code>/</code>&lt;button&gt;
					<code>?bgcolor=</code>&lt;bgcolor HEX&gt;
					<br />
					<i>Change background color of button</i>
				</li>
				<li>
					<code>/style/bank/</code>&lt;page&gt;<code>/</code>&lt;button&gt;
					<code>?color=</code>&lt;color HEX&gt;
					<br />
					<i>Change color of text on button</i>
				</li>
				<li>
					<code>/style/bank/</code>&lt;page&gt;<code>/</code>&lt;button&gt;
					<code>?text=</code>&lt;text&gt;
					<br />
					<i>Change text on a button</i>
				</li>
				<li>
					<code>/style/bank/</code>&lt;page&gt;<code>/</code>&lt;button&gt;
					<code>?size=</code>&lt;text size&gt;
					<br />
					<i>Change text size on a button (between the predefined values)</i>
				</li>

				<li>
					POST <code>/api/custom-variable/</code>&lt;name&gt;<code>/value?value=</code>&lt;value&gt;
					<br />
					<i>Change custom variable value</i>
				</li>
				<li>
					POST <code>/api/custom-variable/</code>&lt;name&gt;<code>/value</code> <code>&lt;value&gt;</code>
					<br />
					<i>Change custom variable value</i>
				</li>
				<li>
					POST <code>/surfaces/rescan</code>
					<br />
					<i>Make Companion rescan for newly attached USB surfaces</i>
				</li>
			</ul>

			<p>
				<strong>Examples</strong>
			</p>

			<p>
				Press page 1 button 2
				<br />
				<code>/press/bank/1/2</code>
			</p>

			<p>
				Change the text of button 4 on page 2 to TEST
				<br />
				<code>/style/bank/2/4/?text=TEST</code>
			</p>

			<p>
				Change the text of button 4 on page 2 to TEST, background color to #ffffff, text color to #000000 and font size
				to 28px
				<br />
				<code>/style/bank/2/4/?text=TEST&bgcolor=%23ffffff&color=%23000000&size=28px</code>
			</p>

			<p>
				Change custom variable &quot;cue&quot; to value &quot;intro&quot;
				<br />
				<code>/set/custom-variable/cue?value=intro</code>
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
					<code>/style/bank/</code>&lt;page&gt;<code>/</code>&lt;button&gt;
					<code>?bgcolor=</code>&lt;bgcolor HEX&gt;
					<br />
					<i>Change background color of button</i>
				</li>
				<li>
					<code>/style/bank/</code>&lt;page&gt;<code>/</code>&lt;button&gt;
					<code>?color=</code>&lt;color HEX&gt;
					<br />
					<i>Change color of text on button</i>
				</li>
				<li>
					<code>/style/bank/</code>&lt;page&gt;<code>/</code>&lt;button&gt;
					<code>?text=</code>&lt;text&gt;
					<br />
					<i>Change text on a button</i>
				</li>
				<li>
					<code>/style/bank/</code>&lt;page&gt;<code>/</code>&lt;button&gt;
					<code>?size=</code>&lt;text size&gt;
					<br />
					<i>Change text size on a button (between the predefined values)</i>
				</li>
				<li>
					<code>/set/custom-variable/</code>&lt;name&gt;<code>?value=</code>&lt;value&gt;
					<br />
					<i>Change custom variable value</i>
				</li>
				<li>
					<code>/rescan</code>
					<br />
					<i>Make Companion rescan for newly attached USB surfaces</i>
				</li>
			</ul>
		</>
	)
}
