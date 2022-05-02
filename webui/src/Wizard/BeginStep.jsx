import React from 'react'

export function BeginStep() {
	return (
		<div>
			<p style={{ marginTop: 0 }}>
				Whether you are a new user or upgrading, there are a number of settings you should review before using
				Companion. This wizard will walk you through the following configuration settings:
			</p>
			<ol>
				<li>USB Surface Detection Configuration</li>
				<li>Remote Control Services</li>
				<li>Admin GUI Password</li>
			</ol>
		</div>
	)
}
