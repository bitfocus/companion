import type { ExtendedInputField, InternalInputField, IsVisibleFunction } from '@companion-app/shared/Model/Options.js'
import { useMemo, useEffect, useState } from 'react'
import { deepFreeze, sandbox } from '../util.js'
import type { CompanionOptionValues } from '@companion-module/base'
import { cloneDeep } from 'lodash-es'
import { toJS } from 'mobx'

interface IsVisibleFunctionEntry {
	fn: IsVisibleFunction
	data: any
}

export function useOptionsAndIsVisible<
	T extends ExtendedInputField | InternalInputField = ExtendedInputField | InternalInputField,
>(
	itemOptions: Array<T> | undefined | null,
	optionValues: CompanionOptionValues | undefined | null
): [options: Array<T>, optionVisibility: Record<string, boolean | undefined>] {
	const [optionVisibility, setOptionVisibility] = useState<Record<string, boolean | undefined>>({})

	const [options, isVisibleFns] = useMemo(() => {
		const options = itemOptions ?? []
		const isVisibleFns: Record<string, IsVisibleFunctionEntry> = {}

		for (const option of options) {
			try {
				if (typeof option.isVisibleFn === 'string') {
					isVisibleFns[option.id] = {
						fn: sandbox(option.isVisibleFn),
						data: deepFreeze(toJS(option.isVisibleData)),
					}
				}
			} catch (e) {
				console.error('Failed to process isVisibleFn', e)
			}
		}

		return [options, isVisibleFns]
	}, [itemOptions])

	useEffect(() => {
		const visibility: Record<string, boolean> = {}

		if (optionValues) {
			for (const [id, entry] of Object.entries(isVisibleFns)) {
				try {
					if (entry && typeof entry.fn === 'function') {
						visibility[id] = entry.fn(cloneDeep(toJS(optionValues)), entry.data)
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
	}, [isVisibleFns, optionValues])

	return [options, optionVisibility]
}
