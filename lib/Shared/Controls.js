export function GetStepIds(steps) {
	return Object.keys(steps).sort((a, b) => Number(a) - Number(b))
}
