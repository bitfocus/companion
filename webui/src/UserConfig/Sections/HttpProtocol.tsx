import React from 'react'

export function HttpProtocol(): React.JSX.Element {
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
					Change background color of button
					<br />
					Method: <code>POST</code>
					<br />
					Path: <code>/api/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;
					<code>/style?bgcolor=</code>&lt;bgcolor HEX&gt;
				</li>
				<li>
					Change color of text on button
					<br />
					Method: <code>POST</code>
					<br />
					Path: <code>/api/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;
					<code>/style?color=</code>&lt;color HEX&gt;
				</li>
				<li>
					Change text on a button
					<br />
					Method: <code>POST</code>
					<br />
					Path: <code>/api/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;
					<code>/style?text=</code>&lt;text&gt;
				</li>
				<li>
					Change text size on a button (between the predefined values)
					<br />
					Method: <code>POST</code>
					<br />
					Path: <code>/api/location/</code>&lt;page&gt;<code>/</code>&lt;row&gt;<code>/</code>&lt;column&gt;
					<code>/style?size=</code>&lt;text size&gt;
				</li>
				<br />
				<li>
					Change custom variable value
					<br />
					Method: <code>POST</code>
					<br />
					Path: <code>/api/custom-variable/</code>&lt;name&gt;<code>/value?value=</code>&lt;value&gt;
				</li>
				<li>
					Change custom variable value
					<br />
					Method: <code>POST</code>
					<br />
					Path: <code>/api/custom-variable/</code>&lt;name&gt;<code>/value</code> <code>&lt;value&gt;</code>
				</li>
				<li>
					Get custom variable value
					<br />
					Method: <code>GET</code>
					<br />
					Path: <code>/api/custom-variable/</code>&lt;name&gt;<code>/value</code>
				</li>
				<li>
					Get Module variable value
					<br />
					Method: <code>GET</code>
					<br />
					Path: <code>/api/variable/</code>&lt;Connection label&gt;<code>/</code>&lt;name&gt;<code>/value</code>
				</li>
				<li>
					Make Companion rescan for newly attached USB surfaces
					<br />
					Method: <code>POST</code>
					<br />
					Path: <code>/api/surfaces/rescan</code>
				</li>
				<br />
				<li>
					Get all custom variables in JSON format
					<br />
					Method: <code>GET</code>
					<br />
					Content-Type: <code>application/json</code>
					<br />
					Path: <code>/api/variables/custom/json</code>
				</li>
				<li>
					Get all expression variables in JSON format
					<br />
					Method: <code>GET</code>
					<br />
					Content-Type: <code>application/json</code>
					<br />
					Path: <code>/api/variables/expression/json</code>
				</li>
				<li>
					Get all module/connection variables in JSON format
					<br />
					Method: <code>GET</code>
					<br />
					Content-Type: <code>application/json</code>
					<br />
					Path: <code>/api/variables/</code>&lt;Connection label&gt;<code>/json</code>
				</li>
				<br />
				<li>
					Get all custom variables as Prometheus metrics
					<br />
					Method: <code>GET</code>
					<br />
					Path: <code>/api/variables/custom/prometheus</code>
				</li>
				<li>
					Get all expression variables as Prometheus metrics
					<br />
					Method: <code>GET</code>
					<br />
					Path: <code>/api/variables/expression/prometheus</code>
				</li>
				<li>
					Get all module/connection variables as Prometheus metrics
					<br />
					Method: <code>GET</code>
					<br />
					Path: <code>/api/variables/</code>&lt;Connection label&gt;<code>/prometheus</code>
				</li>
				Press page 1 row 0 column 2
				<br />
				POST <code>/api/location/1/0/2/press</code>
			</ul>
			<p>
				Change the text of row 0 column 4 on page 2 to TEST
				<br />
				POST <code>/api/location/1/0/4/style?text=TEST`</code>
			</p>

			<p>
				Change the text of row 1, column 4 on page 2 to TEST, background color to #ffffff, text color to #000000 and
				font size to 28px
				<br />
				POST <code>/api/location/2/1/4/style</code> with body{' '}
				<code>{'{ "text": "TEST", "bgcolor": "#ffffff", "color": "#000000", "size": 28 }'}</code>
			</p>

			<p>
				Change custom variable &quot;cue&quot; to value &quot;intro&quot
				<br />
				POST <code>/api/custom-variable/cue/value?value=intro</code>
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
