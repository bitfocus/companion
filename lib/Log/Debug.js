import util from 'util'

/**
 *
 * @param {string} logSource
 * @param {string} debugNamespace
 * @returns {?function}
 */
function registerDebug(logSource, debugNamespace) {
	if (global.logger) {
		global.logger.register(logSource, debugNamespace)

		return function (...messages) {
			try {
				global.logger.add(logSource, 'debug', ...messages)
			} catch (e) {
				console.log(e.message)
			}
		}
	} else {
		return function (...messages) {
			console.log(util.format(messages))
		}
	}
}

export default registerDebug
