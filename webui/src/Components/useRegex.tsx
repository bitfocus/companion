import { useMemo } from 'react'
import { compileRegex } from '@companion-module/host'

export function useRegex(regex: string | undefined): RegExp | null {
	return useMemo(() => compileRegex(regex), [regex])
}
