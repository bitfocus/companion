// NOTE: *** This is a internal method. DO NOT call or override. ***
const serializeIsVisibleFn = (options = []) => {
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

module.exports = {
	serializeIsVisibleFn,
}
