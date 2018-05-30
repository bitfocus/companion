var been_connected = false;


socket.on('connect', function() {
	if (been_connected === true) {
		window.location.reload(true);
	}
	been_connected = true;
});

$(function() {

	socket.on('skeleton-info', function(hash) {
		console.log("skeleton-info", hash);
		$("#versiontext").text(hash.appVersion);
	});


	socket.on('disconnect', function() {
		$("#error-container").fadeIn();
	})

});
