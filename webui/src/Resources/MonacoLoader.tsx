import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import { registerCompanionExpressionLanguage } from './Expression.monarch.js'

self.MonacoEnvironment = {
	getWorker(_, label) {
		if (label === 'json') {
			return new jsonWorker()
		}
		if (label === 'css' || label === 'scss' || label === 'less') {
			return new cssWorker()
		}
		if (label === 'html' || label === 'handlebars' || label === 'razor') {
			return new htmlWorker()
		}
		if (label === 'typescript' || label === 'javascript') {
			return new tsWorker()
		}
		return new editorWorker()
	},
}

loader.config({ monaco })

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
