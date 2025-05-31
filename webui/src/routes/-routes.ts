import { rootRoute, route, physical, layout } from '@tanstack/virtual-file-routes'

export const routes = rootRoute('__root.tsx', [
	// Use default folder routing
	physical('', 'self-contained'),
	layout('_app.tsx', [physical('', 'app')]),

	// Add in a few backwards compatibility redirects
	route('/help.html', '-redirects/help-html.tsx'),
	route('/emulator2', '-redirects/emulator2.tsx'),
	route('/emulators', '-redirects/emulators.tsx'),
	route('/emulator.html', '-redirects/emulator-html.tsx'),

	route('/tablet.html', '-redirects/tablet-html.tsx'),
	route('/tablet2.html', '-redirects/tablet2-html.tsx'),
	route('/ipad.html', '-redirects/ipad-html.tsx'),
	route('/tablet3', '-redirects/tablet3.tsx'),
])
