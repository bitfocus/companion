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
			<p>
				Once you have completed the wizard, it is strongly advised to review the programming of all of your buttons and
				triggers, as some bits may have gotten broken during the upgrade to v3.0
			</p>
		</div>
	)
}
