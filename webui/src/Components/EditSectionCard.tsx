import classNames from 'classnames'
import './EditSectionCard.css'

/** A titled section of an instance's edit panel (General Settings, Configuration, Diagnostics, …). */
export function EditSectionCard({
	title,
	children,
	danger,
	collapsible,
	summary,
}: {
	title: string
	children: React.ReactNode
	danger?: boolean
	collapsible?: boolean
	summary?: string
}): React.JSX.Element {
	const heading = (
		<>
			<h4>{title}</h4>
			{summary && <span className="edit-section-summary">{summary}</span>}
		</>
	)
	const content = <div className="edit-section-body">{children}</div>
	const sectionClass = classNames('edit-section', danger && 'edit-section-danger')
	return collapsible ? (
		<details className={sectionClass}>
			<summary>{heading}</summary>
			{content}
		</details>
	) : (
		<section className={sectionClass}>
			<div className="edit-section-heading">{heading}</div>
			{content}
		</section>
	)
}
