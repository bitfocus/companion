import { useMemo } from 'react'
import { compileRegex } from '@companion-app/shared/ValidateInputValue.js'

export function useRegex(regex: string | undefined): RegExp | null {
	return useMemo(() => compileRegex(regex), [regex])
}
