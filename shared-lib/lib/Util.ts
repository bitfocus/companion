/**
 * Pad a string to the specified length
 */
export function pad(str0: string | number, ch: string, len: number): string {
	let str = str0 + ''

	while (str.length < len) {
		str = ch + str
	}

	return str
}

/** Type assert that a value is never */
export function assertNever(_val: never): void {
	// Nothing to do
}

type TimeGetter = (largest: boolean) => number
type TimeValues = {
	S: number
	s: TimeGetter
	m: TimeGetter
	H: TimeGetter
	h: TimeGetter
	d: TimeGetter
	n: string
	a: string
}

const TIME_VALUE_KEYS = ['S', 's', 'm', 'H', 'h', 'd', 'n', 'a'] as const
function isKeyOfTimeValues(k: string): k is keyof TimeValues {
	return TIME_VALUE_KEYS.includes(k as keyof TimeValues)
}

const CAN_BE_LARGEST_UNIT = ['H', 'h', 'm', 's'] as const
function canBeLargestUnit(k: string): k is (typeof CAN_BE_LARGEST_UNIT)[number] {
	return CAN_BE_LARGEST_UNIT.includes(k as (typeof CAN_BE_LARGEST_UNIT)[number])
}

function createTimeValues(v: number): TimeValues {
	const negative = v < 0 ? '-' : ''
	v = Math.abs(v)
	const totalSeconds = Math.floor(v / 1000)
	const totalMinutes = Math.floor(v / (1000 * 60))
	const totalHours = Math.floor(v / (1000 * 60 * 60))

	return {
		n: negative,
		S: v % 1000,
		s: (largest) => (largest ? totalSeconds : totalSeconds % 60),
		m: (largest) => (largest ? totalMinutes : totalMinutes % 60),
		H: (largest) => (largest ? totalHours : totalHours % 24),
		h: (largest) => (largest ? totalHours : totalHours % 12),
		d: (_largest) => Math.floor(v / (1000 * 60 * 60 * 24)),
		a: totalHours % 24 >= 12 ? 'PM' : 'AM',
	}
}

function truncateMilliseconds(v: number, length: number) {
	if (length > 3) throw new Error('"S" can only pad to 3')
	const divisor = [100, 10, 1][length - 1]
	return pad(Math.trunc(v / divisor), '0', length)
}

export function msToStamp(v: number, format: string): string {
	const values = createTimeValues(v)

	let inBracket = false
	let outBracket = false
	let largestUnit: string | null = null
	let lastChar = ''
	let accChar = ''

	const handleLargestUnit = (u: string) => {
		if (inBracket && !outBracket) {
			if (!canBeLargestUnit(u)) {
				throw new Error(`"${u}" can not be set as largest unit`)
			}
			if (largestUnit !== u && largestUnit !== null) {
				throw new Error('there can only be one unit inside "[ ]"')
			}
			largestUnit = u
		}
	}

	const result: string[] = []
	format += ' '
	for (const c of format) {
		if (c === '[') {
			if (inBracket) throw new Error('"[" was already set')
			if (outBracket) throw new Error('"[" can not come after "]"')
			inBracket = true
			continue
		}
		if (c === ']') {
			if (!inBracket) throw new Error('"[" missing')
			if (outBracket) throw new Error('"]" was already set')
			if (largestUnit === null) throw new Error('"]" cant be set on empty unit')
			outBracket = true
			continue
		}
		handleLargestUnit(c)
		if (c !== lastChar) {
			if (isKeyOfTimeValues(lastChar)) {
				if (lastChar === 'n' || lastChar === 'a') {
					result.push(values[lastChar])
				} else if (lastChar === 'S') {
					result.push(truncateMilliseconds(values[lastChar], accChar.length))
				} else {
					const isLargestUnit = lastChar === largestUnit
					result.push(pad(values[lastChar](isLargestUnit), '0', accChar.length))
				}
			} else {
				result.push(accChar)
			}
			accChar = ''
		}

		accChar += c
		lastChar = c
	}
	return result.join('').trim()
}
