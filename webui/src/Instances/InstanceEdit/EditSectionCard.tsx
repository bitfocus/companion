import classNames from 'classnames'
import './InstanceEditPanel.css'

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
			{summary && <span className="instance-edit-section-summary">{summary}</span>}
		</>
	)
	const content = <div className="instance-edit-section-body">{children}</div>
	const sectionClass = classNames('instance-edit-section', danger && 'instance-edit-section-danger')
	return collapsible ? (
		<details className={sectionClass}>
			<summary>{heading}</summary>
			{content}
		</details>
	) : (
		<section className={sectionClass}>
			<div className="instance-edit-section-heading">{heading}</div>
			{content}
		</section>
	)
}
