import './PageIntro.css'

export interface PageIntroProps {
	title: string
	children: React.ReactNode
}

/** The muted card a page puts above its content, introducing what the page is for. */
export function PageIntro({ title, children }: PageIntroProps): React.JSX.Element {
	return (
		<div className="page-intro">
			<h4>
				<span>{title}</span>
			</h4>
			<p>{children}</p>
		</div>
	)
}
