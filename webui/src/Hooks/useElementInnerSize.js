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
			width: (!ref ? 0 : ref.clientWidth) || 0,
			height: (!ref ? 0 : ref.clientHeight) || 0,
		})
	}, [ref])

	useEventListener('resize', handleSize)
	useIsomorphicLayoutEffect(() => {
		handleSize()
	}, [!ref ? 0 : ref.clientHeight, !ref ? 0 : ref.clientWidth])

	return [setRef, size]
}
