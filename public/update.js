$(function() {

	socket.on('update_data', function(data) {
		console.log('###### data', data);
		if (data.message) {
			$("#newversiontext").html(data.message);
			if (data.link !== undefined) {
				$("#newversiontext").attr('href', data.link);
			}
		}
	});

	socket.emit('update_data');

});
