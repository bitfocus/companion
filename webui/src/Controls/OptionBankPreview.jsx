import React from 'react'
import { nanoid } from 'nanoid'
import { useContext, useMemo } from 'react'
import { useSharedBankRenderCache } from '../ButtonRenderCache'
import { BankPreview } from '../Components/BankButton'
import { ButtonRenderCacheContext, ParseControlId } from '../util'

/**
 * Preview a bank based on the selected options
 * @param {Array} param.fields [page, bank] name of fields to check
 * @param {Object} param.options options object containing the pgae information
 * @param {string} param.controlId control where this preview is located (if any)
 * @returns
 */
export function OptionBankPreview({ fields, options, controlId }) {
	const buttonCache = useContext(ButtonRenderCacheContext)

	let page = options[fields[0]]
	let bank = options[fields[1]]

	const parsedControlId = ParseControlId(controlId)
	if (parsedControlId && parsedControlId.type === 'bank') {
		page = page || parsedControlId.page
		bank = bank || parsedControlId.bank
	}

	const sessionId = useMemo(() => nanoid(), [])
	const image = useSharedBankRenderCache(buttonCache, sessionId, page, bank)

	return <BankPreview fixedSize noPad preview={image} />
}
