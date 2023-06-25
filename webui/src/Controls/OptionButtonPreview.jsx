import React, { useContext, useMemo } from 'react'
import { nanoid } from 'nanoid'
import { useSharedBankRenderCache } from '../ButtonRenderCache'
import { ButtonPreview } from '../Components/ButtonPreview'
import { ButtonRenderCacheContext } from '../util'

/**
 * Preview a bank based on the selected options
 * @param {string} param.location where this preview is located (if any)
 * @returns
 */
export function OptionButtonPreview({ pageNumber, column, row }) {
	const buttonCache = useContext(ButtonRenderCacheContext)

	// Rewrap the properties, to avoid unnecessary renders
	const location = useMemo(() => ({ pageNumber, column, row }), [pageNumber, column, row])

	const sessionId = useMemo(() => nanoid(), [])
	const image = useSharedBankRenderCache(buttonCache, sessionId, location)

	return <ButtonPreview fixedSize noPad preview={image} />
}
