import React from 'react'
import { nanoid } from 'nanoid'
import { useContext, useMemo } from 'react'
import { useSharedBankRenderCache } from '../ButtonRenderCache'
import { BankPreview } from '../Components/BankButton'
import { ButtonRenderCacheContext } from '../util'
import { ParseControlId } from '@companion/shared/ControlId.js'

/**
 * Preview a bank based on the selected options
 * @param {Array} param.fields [page, bank] name of fields to check
 * @param {Object} param.options options object containing the pgae information
 * @param {string} param.controlId control where this preview is located (if any)
 * @returns
 */
export function OptionBankPreview({ controlId }) {
	const buttonCache = useContext(ButtonRenderCacheContext)

	let page = 0
	let bank = 0

	const parsedControlId = ParseControlId(controlId)
	if (parsedControlId && parsedControlId.type === 'bank') {
		page = parsedControlId.page
		bank = parsedControlId.bank
	}

	const sessionId = useMemo(() => nanoid(), [])
	const image = useSharedBankRenderCache(buttonCache, sessionId, page, bank)

	return <BankPreview fixedSize noPad preview={image} />
}
