import type { ExtendedInputField, InternalInputField, IsVisibleFunction } from '@companion/shared/Model/Options'
import { useMemo, useEffect, useState } from 'react'
import { sandbox } from '../util'
import { CompanionOptionValues } from '@companion-module/base'

interface IsVisibleFunctionEntry {
	fn: IsVisibleFunction
	data: any
}

export function useOptionsAndIsVisible(
	itemSpec: { options: Array<ExtendedInputField | InternalInputField> } | undefined,
	item: { options: CompanionOptionValues } | undefined
): [options: Array<ExtendedInputField | InternalInputField>, optionVisibility: Record<string, boolean | undefined>] {
	const [optionVisibility, setOptionVisibility] = useState<Record<string, boolean | undefined>>({})

	const [options, isVisibleFns] = useMemo(() => {
		const options = itemSpec?.options ?? []
		const isVisibleFns: Record<string, IsVisibleFunctionEntry> = {}

		for (const option of options) {
			try {
				if (typeof option.isVisibleFn === 'string') {
					isVisibleFns[option.id] = {
						fn: sandbox(option.isVisibleFn),
						data: option.isVisibleData,
					}
				}
			} catch (e) {
				console.error('Failed to process isVisibleFn', e)
			}
		}

		return [options, isVisibleFns]
	}, [itemSpec])

	useEffect(() => {
		const visibility: Record<string, boolean> = {}

		if (item) {
			for (const [id, entry] of Object.entries(isVisibleFns)) {
				try {
					if (entry && typeof entry.fn === 'function') {
						visibility[id] = entry.fn(item.options, entry.data)
					}
				} catch (e) {
					console.error('Failed to check visibility', e)
				}
			}
		}

		setOptionVisibility(visibility)

		return () => {
			setOptionVisibility({})
		}
	}, [isVisibleFns, item])

	return [options, optionVisibility]
}
