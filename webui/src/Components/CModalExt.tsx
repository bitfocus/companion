import { CModal, CModalProps } from '@coreui/react/dist/esm/components/modal/CModal.js'
import React, { forwardRef, useCallback, useRef } from 'react'

export interface CModalExtProps extends CModalProps {
	onClosed?: () => void
	onOpened?: () => void
}

export const CModalExt = forwardRef<HTMLDivElement, CModalExtProps>(function CModalExt(
	{ onShow, onOpened, onClose, onClosed, ...props }: CModalExtProps,
	ref
) {
	// This needs to be about the same as the coreui fade duration, but a little higher to clear the data as expected
	const fadeOutDuration = 1500
	const fadeInDuration = 1000

	const clearTimeoutRef = useRef<NodeJS.Timeout>()

	const onShowExt = useCallback(() => {
		if (clearTimeoutRef) clearTimeout(clearTimeoutRef.current)

		if (onOpened) setTimeout(onOpened, fadeInDuration)

		onShow?.()
	}, [onShow, onOpened])

	const onCloseExt = useCallback(() => {
		if (clearTimeoutRef) clearTimeout(clearTimeoutRef.current)

		if (onClosed) clearTimeoutRef.current = setTimeout(onClosed, fadeOutDuration)

		onClose?.()
	}, [onClose, onClosed])

	return <CModal ref={ref} {...props} onShow={onShowExt} onClose={onCloseExt} />
})
