import React from 'react'

interface BeginStepProps {
	allowGrid: number
}

export function BeginStep({ allowGrid }: BeginStepProps): React.JSX.Element {
	return (
		<div>
			<p style={{ marginTop: 0 }}>
				Whether you are a new user or upgrading, there are a number of settings you should review before using
				Companion. This wizard will walk you through the following configuration settings:
			</p>
			<ol>
				<li>Surface Detection Configuration</li>
				{allowGrid === 1 && <li>Button Grid Size</li>}
				<li>Remote Control Services</li>
				<li>Admin GUI Password</li>
			</ol>
		</div>
	)
}
