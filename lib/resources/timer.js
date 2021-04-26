function delay(milliseconds) {
	return new Promise((resolve) => {
		setTimeout(() => resolve(), milliseconds);
	});
}

module.exports = delay;