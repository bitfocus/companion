import type jsep from 'jsep'

const NUM_0_CODE = 48
const UNDERSCORE = 95

export default {
	name: 'numbers',

	init(Jsep: any) {
		Jsep.hooks.add('gobble-token', function gobbleNumber(this: any, env: any) {
			if (this.code === NUM_0_CODE) {
				const startIndex = this.index
				const numType = this.expr.charAt(this.index + 1)
				const ranges = getNumberCodeRanges.call(this, numType)
				if (!ranges) {
					return
				}

				let number = ''
				while (isUnderscoreOrWithinRange(this.code, ranges)) {
					if (this.code === UNDERSCORE) {
						this.index++
					} else {
						number += this.expr.charAt(this.index++)
					}
				}

				// confirm valid syntax after building number string within ranges
				if (Jsep.isIdentifierPart(this.code)) {
					if (Jsep.isDecimalDigit(this.code) && Jsep.isDecimalDigit(numType.charCodeAt(0))) {
						// abort octal processing and reset to ignore the leading 0
						this.index = startIndex + 1
						gobbleBase10.call(this, env)
						return
					}
					this.throwError('unexpected char within number')
				}

				env.node = {
					type: Jsep.LITERAL,
					value: parseInt(number, getNumberBase(numType)),
					raw: this.expr.substring(startIndex, this.index),
				}
			} else if (
				Jsep.isDecimalDigit(this.code) ||
				(this.code === Jsep.PERIOD_CODE && this.expr.charCodeAt(this.index + 1) !== Jsep.PERIOD_CODE)
			) {
				gobbleBase10.call(this, env)
			}
		})

		/**
		 * Gets the range of allowable number codes (decimal) and updates index
		 * @param {string} numType
		 * @returns {number[][]|null}
		 */
		function getNumberCodeRanges(this: any, numType: string) {
			if (numType === 'x' || numType === 'X') {
				this.index += 2
				return [
					[48, 57], // 0-9
					[65, 70], // A-F
					[97, 102], // a-f
				]
			} else if (numType === 'b' || numType === 'B') {
				this.index += 2
				return [[48, 49]] // 0-1
			} else if (numType === 'o' || numType === 'O' || (numType >= '0' && numType <= '7')) {
				// 0-7 allows non-standard 0644 = 420
				this.index += numType <= '7' ? 1 : 2
				return [[48, 55]] // 0-7
			}
			return null
		}

		/**
		 * Supports Hex, Octal and Binary only
		 * @param {string} numType
		 * @returns {16|8|2}
		 */
		function getNumberBase(numType: string) {
			if (numType === 'x' || numType === 'X') {
				return 16
			} else if (numType === 'b' || numType === 'B') {
				return 2
			}
			// default (includes non-stand 044)
			return 8
		}

		/**
		 * Verifies number code is within given ranges
		 * @param {number} code
		 * @param {number[][]} ranges
		 */
		function isUnderscoreOrWithinRange(code: number, ranges: number[][]) {
			return code === UNDERSCORE || ranges.some(([min, max]) => code >= min && code <= max)
		}

		/**
		 * Same as core gobbleNumericLiteral, but allows for _ char
		 * @param {{ context?: typeof Jsep, node?: Expression }} env
		 */
		function gobbleBase10(this: any, env: any) {
			const startIndex = this.index
			let number = ''

			const gobbleDigits = () => {
				while (Jsep.isDecimalDigit(this.code) || this.code === UNDERSCORE) {
					if (this.code === UNDERSCORE) {
						this.index++
					} else {
						number += this.expr.charAt(this.index++)
					}
				}
			}

			gobbleDigits()
			if (this.code === Jsep.PERIOD_CODE) {
				// can start with a decimal marker
				number += this.expr.charAt(this.index++)

				gobbleDigits()
			}

			let ch = this.char
			if (ch === 'e' || ch === 'E') {
				// exponent marker
				number += this.expr.charAt(this.index++)
				ch = this.char

				if (ch === '+' || ch === '-') {
					// exponent sign
					number += this.expr.charAt(this.index++)
				}

				gobbleDigits() // exponent itself

				if (!Jsep.isDecimalDigit(this.expr.charCodeAt(this.index - 1))) {
					this.throwError('Expected exponent (' + number + this.char + ')')
				}
			}

			const chCode = this.code
			const prevCode = this.expr.charCodeAt(this.index - 1)

			// Check to make sure this isn't a variable name that start with a number (123abc)
			if (Jsep.isIdentifierStart(chCode)) {
				this.throwError('Variable names cannot start with a number (' + number + this.char + ')')
			} else if (chCode === Jsep.PERIOD_CODE && prevCode === Jsep.PERIOD_CODE) {
				// two `..` with at least one digit already processed (otherwise gobbleBase10 wouldn't have been called)
				// rollback index and let Jsep see if it's an operator...
				this.index--
			} else if (number.length === 1 && number.charCodeAt(0) === Jsep.PERIOD_CODE) {
				this.throwError('Unexpected period')
			}

			env.node = {
				type: Jsep.LITERAL,
				value: parseFloat(number),
				raw: this.expr.substring(startIndex, this.index),
			}
		}
	},
} as jsep.IPlugin
