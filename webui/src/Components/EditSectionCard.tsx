import classNames from 'classnames'
import './EditSectionCard.css'

/** A titled section of an instance's edit panel (General Settings, Configuration, Diagnostics, …). */
export function EditSectionCard({
	title,
	children,
	danger,
	summary,
}: {
	title: string
	children: React.ReactNode
	danger?: boolean
	/** Shown beside the title, eg a count or a status */
	summary?: React.ReactNode
}): React.JSX.Element {
	return (
		<section className={classNames('edit-section', danger && 'edit-section-danger')}>
			<div className="edit-section-heading">
				<h4>{title}</h4>
				{summary && <span className="edit-section-summary">{summary}</span>}
			</div>
			<div className="edit-section-body">{children}</div>
		</section>
	)
}
