import { init, showReportDialog, configureScope, addBreadcrumb } from '@sentry/electron'
import Registry from '../Registry.js'

/**
 * Setup an Electron Sentry session
 * @param {Registry} registry - the application core
 * @param {string} dsn - the Sentry DSN
 * @returns {?function} the <code>addBreadcrumb</code> Sentry function
 */
function sentryElectron(registry, dsn) {
	init({
		dsn: dsn,
		release: `companion@${registry.appBuild || registry.appVersion}`,
		beforeSend(event) {
			if (event.exception) {
				showReportDialog()
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

export default sentryElectron
