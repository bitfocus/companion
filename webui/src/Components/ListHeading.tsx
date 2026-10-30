import { faAnglesDown, faAnglesUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { Button } from './Button.js'

/** Expanding and collapsing every item of a list */
export interface ListHeadingCollapse {
	canExpandAll: boolean
	canCollapseAll: boolean
	expandAll: () => void
	collapseAll: () => void
}

interface ListHeadingProps {
	heading: React.ReactNode
	/** Shown below the heading, such as a description of the list */
	subheading: React.ReactNode
	/** Buttons for the list, shown after expand and collapse all */
	actions: React.ReactNode
	collapse: ListHeadingCollapse | null
}

/**
 * The heading of a list of collapsible items, such as the actions of a control, with buttons to expand or collapse
 * every item
 */
export function ListHeading({ heading, subheading, actions, collapse }: ListHeadingProps): React.JSX.Element | null {
	const canExpandAll = !!collapse?.canExpandAll
	const canCollapseAll = !!collapse?.canCollapseAll
	if (!heading && !actions && !canExpandAll && !canCollapseAll) return null

	return (
		<>
			<div
				className={classNames('entity-editor-heading flex items-center justify-between gap-2 my-2', {
					'mb-0': !!subheading,
				})}
			>
				<div className="entity-editor-heading-title text-base font-semibold text-body">{heading}</div>

				<div className="entity-editor-heading-actions flex items-center gap-1 shrink-0">
					{canExpandAll && (
						<Button
							variant="ghost"
							size="sm"
							onClick={collapse?.expandAll}
							title="Expand all"
							className="text-xs px-2 py-0.5 flex items-center gap-1.5"
						>
							<FontAwesomeIcon icon={faAnglesDown} className="text-2xs" />
							<span className="text-3xs font-medium">Expand all</span>
						</Button>
					)}
					{canCollapseAll && (
						<Button
							variant="ghost"
							size="sm"
							onClick={collapse?.collapseAll}
							title="Collapse all"
							className="text-xs px-2 py-0.5 flex items-center gap-1.5"
						>
							<FontAwesomeIcon icon={faAnglesUp} className="text-2xs" />
							<span className="text-3xs font-medium">Collapse all</span>
						</Button>
					)}
					{actions}
				</div>
			</div>

			{subheading && <div className="mb-2">{subheading}</div>}
		</>
	)
}
