import { CompanionInputFieldBase } from '@companion-module/base'
import { EncodeIsVisible } from '../host-api/api'

export function serializeIsVisibleFn<T extends CompanionInputFieldBase>(options: T[]): EncodeIsVisible<T>[] {
	return options.map((option) => {
		if ('isVisible' in option) {
			if (typeof option.isVisible === 'function') {
				return {
					...option,
					isVisibleFn: option.isVisible.toString(),
					isVisible: undefined,
				}
			}
		}

		// ignore any existing `isVisibleFn` to avoid code injection
		return {
			...option,
			isVisibleFn: undefined,
		}
	})
}
