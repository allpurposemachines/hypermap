const index = {
	completed: 0,
	todos: [
		{
			'@': {
				href: '1/'
			},
			title: 'Buy milk',
			completed: false
		}
	],
	newTodo: {
		'@': {
			href: '',
			method: 'POST'
		},
		title: 'String'
	}
};

const first = {
	title: 'Buy milk',
	completed: false
};

const mockTodoServer = (baseUrl) => ({
	handleRequest: request => {
		const partialResponse = body => ({
			status: 200,
			contentType: 'application/vnd.hypermap+json',
			body: JSON.stringify(body)
		});

		const partialPostReponse = {
			status: 301,
			contentType: 'application/vnd.hypermap+json',
			headers: { 'Location': '/' }
		};

		switch (request.url()) {
			case baseUrl:
				if (request.method() === 'GET') {
					request.respond(partialResponse(index));
				} else if (request.method() === 'POST') {
					index.todos.push({
						'@': {
							href: '2/'
						},
						title: 'Buy cheese',
						completed: false
					});
					request.respond(partialPostReponse);
				}
				break;
			case baseUrl + '1/':
				request.respond(partialResponse(first));
				break;
		}
	}
});

export default mockTodoServer;
