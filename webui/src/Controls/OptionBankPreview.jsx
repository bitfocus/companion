import React from 'react'
import { nanoid } from 'nanoid'
import { useContext, useMemo } from 'react'
import { useSharedBankRenderCache } from '../ButtonRenderCache'
import { BankPreview } from '../Components/BankButton'
import { ButtonRenderCacheContext, ParseControlId } from '../util'

export function OptionBankPreview({ fields, options, controlId }) {
	const buttonCache = useContext(ButtonRenderCacheContext)

	let page = options[fields[0]]
	let bank = options[fields[1]]

	const parsedControlId = ParseControlId(controlId)
	if (parsedControlId && parsedControlId.type === 'bank') {
		page = page || parsedControlId.page
		bank = bank || parsedControlId.bank
	}

	const id = useMemo(() => nanoid(), [])
	const image = useSharedBankRenderCache(buttonCache, id, page, bank)

	return <BankPreview fixedSize noPad preview={image} />
}
