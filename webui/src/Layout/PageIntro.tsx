import './PageIntro.css'

export interface PageIntroProps {
	title: string
	/** Rendered next to the title, e.g. a ContextHelpButton. */
	titleSuffix?: React.ReactNode
	children: React.ReactNode
}

/** The muted card a page puts above its content, introducing what the page is for. */
export function PageIntro({ title, titleSuffix, children }: PageIntroProps): React.JSX.Element {
	return (
		<div className="page-intro">
			<h4>
				<span>{title}</span>
				{titleSuffix}
			</h4>
			<p>{children}</p>
		</div>
	)
}
