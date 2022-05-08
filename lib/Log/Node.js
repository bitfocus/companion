import { init, configureScope, addBreadcrumb } from '@sentry/node'
import '@sentry/tracing'
import Registry from '../Registry.js'

/**
 * Setup a Node.js Sentry session
 * @param {Registry} registry - the application core
 * @param {string} dsn - the Sentry DSN
 * @returns {?function} the <code>addBreadcrumb</code> Sentry function
 */
function sentryNode(registry, dsn) {
	init({
		dsn: dsn,
		release: `companion@${registry.appBuild || registry.appVersion}`,
		beforeSend(event) {
			if (event.exception) {
				console.log('sentry', 'error', event.exception)
			}
			return event
		},
	})

	try {
		configureScope(function (scope) {
			scope.setUser({ id: registry.machineId })
			scope.setExtra('build', registry.appBuild)
		})
	} catch (e) {
		console.log('Error reading BUILD and/or package info: ', e)
	}

	return addBreadcrumb
}

export default sentryNode
