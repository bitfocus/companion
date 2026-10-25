import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from './Button.js'
import './RowButton.css'

export interface RowButtonProps {
	title: React.ReactNode
	/** The line under the title */
	description: React.ReactNode
	onClick: () => void
}

/** A full-width row in a list card that opens what it names, such as the next step of a choice */
export function RowButton({ title, description, onClick }: RowButtonProps): React.JSX.Element {
	return (
		<Button className="row-button" onClick={onClick}>
			<span className="row-button-text">
				<span className="row-button-title">{title}</span>
				{/* Keeps the two lines apart in the button's accessible name; a flex container doesn't lay it out */}{' '}
				<span className="row-button-description">{description}</span>
			</span>
			<FontAwesomeIcon icon={faArrowRight} className="row-button-arrow" aria-hidden="true" />
		</Button>
	)
}
