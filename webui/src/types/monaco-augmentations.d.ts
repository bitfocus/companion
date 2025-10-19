import type { DropdownChoiceInt } from '~/LocalVariableDefinitions.js'

declare module 'monaco-editor' {
	namespace editor {
		interface ITextModel {
			/**
			 * Companion variables available for completion in expression editors.
			 * Stored on the model instance to match existing data flow.
			 */
			_companionVariables?: DropdownChoiceInt[]
		}
	}
}
