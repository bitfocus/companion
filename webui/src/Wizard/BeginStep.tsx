interface BeginStepProps {
	/** Titles of the configurable steps that will be shown, in order */
	stepTitles: string[]
}

export function BeginStep({ stepTitles }: BeginStepProps): React.JSX.Element {
	return (
		<div>
			<p style={{ marginTop: 0 }}>
				Whether you are a new user or upgrading, there are a number of settings you should review before using
				Companion. This wizard will walk you through the following configuration settings:
			</p>
			<ol>
				{stepTitles.map((title) => (
					<li key={title}>{title}</li>
				))}
			</ol>
		</div>
	)
}
