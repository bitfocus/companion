// From Global key number 0->31, to Device key f.ex 0->14
// 0-4 would be 0-4, but 5-7 would be -1
// and 8-12 would be 5-9
module.exports.toDeviceKey = function (keysTotal, keysPerRow, key) {
	if (keysTotal == global.MAX_BUTTONS) {
		return key
	}

	if (key % global.MAX_BUTTONS_PER_ROW > keysPerRow) {
		return -1
	}

	var row = Math.floor(key / global.MAX_BUTTONS_PER_ROW)
	var col = key % global.MAX_BUTTONS_PER_ROW

	if (row >= keysTotal / keysPerRow || col >= keysPerRow) {
		return -1
	}

	return row * keysPerRow + col
}

// From device key number to global key number
// Reverse of toDeviceKey
module.exports.toGlobalKey = function (keysPerRow, key) {
	var rows = Math.floor(key / keysPerRow)
	var col = key % keysPerRow

	return rows * global.MAX_BUTTONS_PER_ROW + col
}
