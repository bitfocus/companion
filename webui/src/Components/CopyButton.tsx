import { faCheck, faCopy } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import copy from 'copy-to-clipboard'
import { useCallback, useState } from 'react'
import { Button, type ButtonColor, type ButtonProps } from './Button'

interface CopyButtonProps {
	text: string
	title?: string
	size?: 'sm' | 'lg'
	className?: string
	color?: ButtonColor
	variant?: ButtonProps['variant']
}

export function CopyButton({
	text,
	title = 'Copy to clipboard',
	size = 'sm',
	className,
	color,
	variant,
}: CopyButtonProps): JSX.Element {
	const [copied, setCopied] = useState(false)

	const handleClick = useCallback(() => {
		copy(text)
			.then((success) => {
				if (!success) {
					console.error('Failed to copy text:', text)
					return
				}

				setCopied(true)
				setTimeout(() => setCopied(false), 2000)
			})
			.catch(() => {
				console.error('Failed to copy text:', text)
			})
	}, [text])

	return (
		<Button
			onMouseDown={handleClick}
			title={copied ? 'Copied!' : title}
			size={size}
			className={className}
			color={color}
			variant={variant}
		>
			<FontAwesomeIcon icon={copied ? faCheck : faCopy} />
		</Button>
	)
}
