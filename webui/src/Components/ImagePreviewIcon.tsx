import { faImage } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useRef, useState } from 'react'
import { Popover } from './Popover.js'
import { useResolvedExpression } from './useResolvedExpression.js'

interface ImagePreviewIconProps {
	value: string | null
}

interface ImagePreviewIconFromExpressionProps {
	expression: string
	controlId: string | null
}

export function ImagePreviewIconFromExpression({
	expression,
	controlId,
}: ImagePreviewIconFromExpressionProps): React.JSX.Element {
	const { result: resolved } = useResolvedExpression(expression, controlId)
	const imageValue = resolved?.ok && typeof resolved.value === 'string' ? resolved.value : null
	return <ImagePreviewIcon value={imageValue} />
}

export function ImagePreviewIcon({ value }: ImagePreviewIconProps): React.JSX.Element {
	const [open, setOpen] = useState(false)
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const triggerRef = useRef<HTMLSpanElement>(null)

	const cancelClose = useCallback(() => {
		if (closeTimerRef.current !== null) {
			clearTimeout(closeTimerRef.current)
			closeTimerRef.current = null
		}
	}, [])

	const scheduleClose = useCallback(() => {
		cancelClose()
		closeTimerRef.current = setTimeout(() => {
			setOpen(false)
			closeTimerRef.current = null
		}, 300)
	}, [cancelClose])

	const hasValue = value !== null

	return (
		<Popover.Root open={open} onOpenChange={setOpen}>
			<span
				ref={triggerRef}
				className="ms-1"
				style={{ opacity: hasValue ? 1 : 0.25, cursor: hasValue ? 'default' : undefined, display: 'inline-block' }}
				onMouseEnter={
					hasValue
						? () => {
								cancelClose()
								setOpen(true)
							}
						: undefined
				}
				onMouseLeave={hasValue ? scheduleClose : undefined}
			>
				<FontAwesomeIcon icon={faImage} />
			</span>
			{hasValue && (
				<Popover.Popup anchor={triggerRef} side="bottom" align="start" arrow>
					<div onMouseEnter={cancelClose} onMouseLeave={scheduleClose} style={{ padding: '0.25rem' }}>
						<img
							src={value}
							alt="Image preview"
							style={{ maxWidth: 300, maxHeight: 300, objectFit: 'contain', display: 'block' }}
						/>
					</div>
				</Popover.Popup>
			)}
		</Popover.Root>
	)
}
