import {
	Application,
	Context,
	Router
} from 'https://deno.land/x/oak@v12.0.1/mod.ts';

const router = new Router();

const nav = {
	home: {
		'@': {
			href: '/'
		}
	}
};

router
	.get('/', ctx => {
		const index = {
			sentimentAnalysisLocal: {
				'@': {
					href: '/sentiment/'
				}
			},
			stocks: {
				'@': {
					href: '/stocks/'
				}
			}
		};
		ctx.response.body = { nav, ...index };
	})
	.get('/sentiment/', ctx => {
		const body = {
			'@': {
				script: '/sentiment.js'
			},
			input: {
				text: null
			},
			sentiment: null
		};
		ctx.response.body = { nav, ...body };
	})
	.get('/stocks/', ctx => {
		const buy = (ticker: string) => ({
			'@': {
				href: ticker + '/buy/',
				method: 'post'
			},
			quantity: 0
		});

		const body = {
			'@': {
				script: '/stocks.js'
			},
			market: {
				ibm: {
					ticker: 'IBM',
					price: 100.0 + Math.random(),
					buy: buy('IBM')
				},
				msft: {
					ticker: 'MSFT',
					price: 200.0 + Math.random(),
					buy: buy('MSFT')
				}
			}
		};

		ctx.response.body = { nav, ...body };
	})
	.post('/stocks/:ticker/buy/', async ctx => {
		const body = await ctx.request.body().value;
		const data = {
			ticker: ctx.params.ticker, ...body
		};
		ctx.response.redirect(`/stocks/${data.ticker}/purchased/?quantity=${data.quantity}`);
	})
	.get('/stocks/:ticker/purchased/', ctx => {
		const body = {
			code: 'Success',
			message: `Successfully purchased shares of ${ctx.params.ticker}`
		};

		ctx.response.body = { nav, ...body };
	});

const app = new Application();

app.use(async (context: Context, next) => {
	context.response.headers.set('Access-Control-Allow-Origin', '*');
	context.response.type = 'application/vnd.hypermap+json; charset=utf-8';
	await next();
});

app.use(router.routes());

app.use(async (context, next) => {
	try {
		context.response.type = 'application/javascript'
		await context.send({
			root: `${Deno.cwd()}/example_server/assets`
		});
	} catch {
		await next();
	}
});

await app.listen({ port: 8000 });
