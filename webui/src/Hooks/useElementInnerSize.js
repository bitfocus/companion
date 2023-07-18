import { useCallback, useState } from 'react'
import { useEventListener, useIsomorphicLayoutEffect } from 'usehooks-ts'

export default function useElementclientSize() {
	const [ref, setRef] = useState(null)
	const [size, setSize] = useState({
		width: 0,
		height: 0,
	})

	const handleSize = useCallback(() => {
		setSize({
			width: (ref === null || ref === void 0 ? void 0 : ref.clientWidth) || 0,
			height: (ref === null || ref === void 0 ? void 0 : ref.clientHeight) || 0,
		})
	}, [
		ref === null || ref === void 0 ? void 0 : ref.clientHeight,
		ref === null || ref === void 0 ? void 0 : ref.clientWidth,
	])

	useEventListener('resize', handleSize)
	useIsomorphicLayoutEffect(() => {
		handleSize()
	}, [
		ref === null || ref === void 0 ? void 0 : ref.clientHeight,
		ref === null || ref === void 0 ? void 0 : ref.clientWidth,
	])
	return [setRef, size]
}
