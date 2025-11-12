import { loader } from '@monaco-editor/react'
import { registerCompanionExpressionLanguage } from './Expression.monarch.js'
import { makeAbsolutePath } from './util.js'

// It would be simpler to import and bundle monaco-editor, but that has a high cost to memory at build time.
// Instead we can treat our own server as a cdn and copy the files into `public` during the build
// Note: this does cost more space on disk
loader.config({
	paths: {
		vs: makeAbsolutePath('_deps/monaco'),
	},
})

let monacoInitialized = false
let monacoPromise: Promise<void> | null = null

/**
 * Initialize Monaco Editor and register custom language support.
 * This is a Suspense-compatible component that will cause React to wait
 * until Monaco is fully loaded before rendering the rest of the app.
 */
export function MonacoLoader(): null {
	if (!monacoInitialized) {
		if (!monacoPromise) {
			monacoPromise = loader
				.init()
				.then((monaco) => {
					registerCompanionExpressionLanguage(monaco)
					monacoInitialized = true
				})
				.catch((error) => {
					console.error('Error initializing Monaco Editor:', error)
					monacoInitialized = true // Mark as initialized even on error to prevent infinite loading
					throw error
				})
		}
		// eslint-disable-next-line @typescript-eslint/only-throw-error
		throw monacoPromise
	}

	return null
}
