import { Italic, Strikethrough, Underline } from 'lucide-react'
import { Button, ButtonGroup } from './Button'

interface TextStylesInputFieldProps {
	id: string | undefined
	value: string[]
	setValue: (value: string[]) => void
	disabled?: boolean
}

const STYLE_OPTIONS = [
	{ id: 'italic', title: 'Italic', icon: Italic },
	{ id: 'underline', title: 'Underline', icon: Underline },
	{ id: 'strikethrough', title: 'Strikethrough', icon: Strikethrough },
] as const

export function TextStylesInputField({
	id,
	value,
	setValue,
	disabled = false,
}: TextStylesInputFieldProps): React.JSX.Element {
	const selected = Array.isArray(value) ? value : []

	const toggle = (styleId: string) => {
		// Rebuild from STYLE_OPTIONS order so the stored array stays in a stable order.
		const next = STYLE_OPTIONS.map((o) => o.id).filter((o) =>
			o === styleId ? !selected.includes(o) : selected.includes(o)
		)
		setValue(next)
	}

	return (
		<ButtonGroup id={id} aria-label="Text styles">
			{STYLE_OPTIONS.map(({ id: styleId, title, icon: Icon }) => (
				<Button
					key={styleId}
					color={selected.includes(styleId) ? 'primary' : 'secondary'}
					onClick={() => toggle(styleId)}
					title={title}
					aria-label={title}
					aria-pressed={selected.includes(styleId)}
					disabled={disabled}
					tabIndex={0}
				>
					<Icon size="1.3rem" />
				</Button>
			))}
		</ButtonGroup>
	)
}
