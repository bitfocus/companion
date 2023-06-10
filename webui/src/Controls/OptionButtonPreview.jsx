import React from 'react'
import { nanoid } from 'nanoid'
import { useContext, useMemo } from 'react'
import { useSharedBankRenderCache } from '../ButtonRenderCache'
import { ButtonPreview } from '../Components/ButtonPreview'
import { ButtonRenderCacheContext } from '../util'
import { formatCoordinate } from '@companion/shared/ControlId'

/**
 * Preview a bank based on the selected options
 * @param {string} param.controlId control where this preview is located (if any)
 * @returns
 */
export function OptionButtonPreview({ pageNumber, coordinate }) {
	const buttonCache = useContext(ButtonRenderCacheContext)

	// let image = RedImage

	pageNumber = pageNumber || 1
	coordinate = coordinate || formatCoordinate(0, 0)

	// TODO-coordinate
	const sessionId = useMemo(() => nanoid(), [])
	const image = useSharedBankRenderCache(buttonCache, sessionId, pageNumber, coordinate)

	return <ButtonPreview fixedSize noPad preview={image} />
}
