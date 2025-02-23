import React from 'react'
import type { SomeLocalVariableDefinition } from '@companion-app/shared/Model/LocalVariables.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'

interface LocalVariablesEditorProps {
	controlId: string
	location: ControlLocation
	variables: Record<string, SomeLocalVariableDefinition>
}
export function LocalVariablesEditor({ controlId }: LocalVariablesEditorProps) {
	return <p>TEST {controlId}</p>
}
