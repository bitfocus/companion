import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import './Note.css'

export type NoteTone = 'neutral' | 'good' | 'warning' | 'danger'

export interface NoteProps {
	/** 'good' only colours the icon; 'warning' and 'danger' tint the whole note and announce it */
	tone: NoteTone
	icon: IconDefinition
	/** Buttons shown at the end of the note, wrapping below the message when there isn't room; null for none */
	actions: React.ReactNode
	className?: string
	children: React.ReactNode
}

/** A compact one-line note: an icon, a short message and optionally an action or two */
export function Note({ tone, icon, actions, className, children }: NoteProps): React.JSX.Element {
	return (
		<div
			className={classNames('inline-note', `inline-note-${tone}`, className)}
			role={tone === 'danger' ? 'alert' : tone === 'warning' ? 'status' : undefined}
		>
			<FontAwesomeIcon icon={icon} className="inline-note-icon" aria-hidden="true" />
			<div className="inline-note-body">{children}</div>
			{actions !== null && <div className="inline-note-actions">{actions}</div>}
		</div>
	)
}

/** Raw detail under a note's message, such as the text of an error */
export function NoteDetail({ children }: { children: React.ReactNode }): React.JSX.Element {
	return <code className="inline-note-detail">{children}</code>
}
