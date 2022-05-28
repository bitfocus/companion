export type CompanionAlignment =
	| 'left:top'
	| 'center:top'
	| 'right:top'
	| 'left:center'
	| 'center:center'
	| 'right:center'
	| 'left:bottom'
	| 'center:bottom'
	| 'right:bottom'

export type CompanionTextSize = 'auto' | '7' | '14' | '18' | '24' | '30' | '44'

/**
 * The basic style properties for a button
 */
export interface CompanionRequiredStyleProps {
	text: string
	size: CompanionTextSize
	color: number
	bgcolor: number
}

/**
 * The additional style properties for a button
 */
export interface CompanionAdditionalStyleProps {
	alignment: CompanionAlignment
	pngalignment: CompanionAlignment
	png64?: string
}
