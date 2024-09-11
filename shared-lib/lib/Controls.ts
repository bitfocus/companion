export function GetStepIds(steps: Record<string, any>): string[] {
	return Object.keys(steps).sort((a, b) => Number(a) - Number(b))
}
