import React from 'react'
import type { LocalVariableDefinition } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'

interface LocalVariablesEditorProps {
	controlId: string
	location: ControlLocation
	variables: Record<string, LocalVariableDefinition>
}
export function LocalVariablesEditor({ controlId }: LocalVariablesEditorProps) {
	return <p>TEST {controlId}</p>
}
