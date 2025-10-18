import type { languages } from 'monaco-editor'
import type { Monaco } from '@monaco-editor/react'

export const COMPANION_EXPRESSION_LANGUAGE_ID = 'companionExpression'

export function registerCompanionExpressionLanguage(monaco: Monaco): void {
	if (!monaco.languages.getLanguages().some((l) => l.id === COMPANION_EXPRESSION_LANGUAGE_ID)) {
		monaco.languages.register({ id: COMPANION_EXPRESSION_LANGUAGE_ID })
	}
	monaco.languages.setLanguageConfiguration(COMPANION_EXPRESSION_LANGUAGE_ID, companionExpressionLanguageConfiguration)
	monaco.languages.setMonarchTokensProvider(COMPANION_EXPRESSION_LANGUAGE_ID, companionExpressionTokensProvider)
}

const companionExpressionLanguageConfiguration: languages.LanguageConfiguration = {}

const companionExpressionTokensProvider: languages.IMonarchLanguage = {
	// TODO
}
