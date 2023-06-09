import fs from 'fs';

const routes = {
	'/': {
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
	},
	'/1/': {
		title: 'Buy milk',
		completed: false
	},
	'/scripts/': {
		'@': {
			script: '/assets/test.js'
		},
		'list': ['middle']
	},
	'/transclude/': {
		todos: {
			'@': {
				href: '/',
				rels: ['transclude']
			}
		},
		counter: {
			'@': {
				href: '/counter/',
				rels: ['transclude']
			}
		}
	},
	'/counter/': {
		count: 0
	},
	'/deep/': {
		one: {
			two: {
				three: {}
			}
		}
	}
}

const mockTodoServer = (baseUrl) => ({
	reset: () => {
		routes['/counter/'] = { count: 0 };
	},

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

		const url = new URL(request.url());

		if (url.toString() === baseUrl && request.method() === 'POST') {
			const { title } = JSON.parse(request.postData());
			routes['/'].todos.push({
				'@': {
					href: '2/'
				},
				completed: false,
				title
			});
			request.respond(partialPostReponse);
			return;
		} else if (url.pathname.split('/').at(1) === 'assets') {
			const fileName = url.pathname.split('/').at(2);
			request.respond({
				status: 200,
				contentType: 'application/javascript',
				body: fs.readFileSync(`./tests/mock_assets/${fileName}`, 'utf8')
			});
		} else if (routes[url.pathname]) {
			request.respond(partialResponse(routes[url.pathname]));
		} else {
			throw new Error(`No response defined for ${url}`);
		}
		
		if (url.pathname === '/counter/') {
			routes['/counter/'] = { count: routes['/counter/'].count + 1 };
		}
	}
});

export default mockTodoServer;
