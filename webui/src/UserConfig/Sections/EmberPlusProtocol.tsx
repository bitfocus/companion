import React, { useContext } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'

export const EmberPlusProtocol = observer(function EmberPlusProtocol() {
	const { userConfig } = useContext(RootAppStoreContext)

	return (
		<>
			<p>
				The EmberPlus provider is accesible on port{' '}
				<code>{userConfig.properties?.emberplus_enabled ? '9092' : 'disabled'}</code>.
			</p>
			<ul>
				<li>
					Companion Product Infomation
					<br />
					Path: <code>/Companion Tree/identity/</code>&lt;parameter name&gt;
					<br />
					Permissions: <code>Read Only</code>
					<br />
					Parameter Types: <code>string</code>
				</li>
				<li>
					Button Manipulation
					<br />
					Path: <code>/Companion Tree/pages/</code>&lt;page name&gt;<code>/</code>&lt;button number&gt;<code>/</code>&lt;parameter name&gt;
					<br />
					Path: <code>/Companion Tree/location/</code>&lt;page number&gt;<code>/</code>&lt;row number&gt;<code>/</code>&lt;column number&gt;<code>/</code>&lt;parameter name&gt;
					<br />
					Permissions: <code>Read/Write</code>
					<br />
					Parameter Types: <code>boolean</code>, <code>string</code>
				</li>
				<li>
					Internal Variables
					<br />
					Path: <code>/Companion Tree/variables/internal/</code>&lt;parameter name&gt;<code>/</code>&lt;parameter type&gt;
					<br />
					Permissions: <code>Read Only</code>
					<br />
					Parameter Types: <code>boolean</code>, <code>integer</code>, <code>string</code>
				</li>
				<li>
					Custom Variables
					<br />
					Path: <code>/Companion Tree/variables/custom/</code>&lt;parameter name&gt;<code>/</code>&lt;parameter type&gt;
					<br />
					Permissions: <code>Read/Write</code>
					<br />
					Parameter Types: <code>string</code>
				</li>
				<li>
					Action Recorder
					<br />
					Path: <code>/Companion Tree/action recorder/</code>&lt;parameter name&gt;
					<br />
					Permissions: <code>Read/Write</code>
					<br />
					Parameter Types: <code>boolean</code>
				</li>
			</ul>

			<p>
				<strong>Provider Restarts</strong>
			</p>

			<p>
			The Ember Plus provider will automatically restart to rebuild the ember tree under the following conditions, as such they should be avoided during production usage:
			<br />
			<ul>
				<li>Page count change</li>
				<li>Button matrix size change</li>
				<li>Adding new connections</li>
				<li>Changing the label of a connection</li>
				<li>Adding new custom variables</li>
			</ul>
			</p>

			<p>
				<strong>Node Stability</strong>
			</p>
			<p>
			The Ember Plus server cannot guarantee the stability of the numerical paths to variables between Companion restarts, as this is contingent upon initialization order. 
			Whenever possible one should preference use of textual paths such as <code>Companion Tree/variables/internal/instance_warns</code> rather than <code>0.3.1.3</code> as these are stable. After significant changes, a full Companion restart can help stabilize the numeric paths.
			</p>
		</>
	)
})
