import { _common } from 'https://jsr.io/@std/path/0.210.0/_common/common.ts';
import { Application, Router } from 'jsr:@oak/oak@12.6.3';

const router = new Router();

function template(body: unknown) {
	const shimUrl = (Deno.env.get('MODE') === 'DEV')
		? 'https://localhost:4000/src/index.js'
		: 'https://cdn.jsdelivr.net/npm/@allpurposemachines/hypermap-shim@0.5.0/+esm';
	return `<!DOCTYPE html>
		<html>
			<head>
				<title>HyperMap Demo!</title>
				<script type="module" src="${shimUrl}"></script>
			</head>
			<body>
				<pre>${JSON.stringify(body)}</pre>
			</body>
		</html>
	`;
}

const nav = {
	home: {
		'#': {
			href: '/'
		}
	}
};

router
	.get('/', (ctx) => {
		const index = {
			sentimentAnalysisLocal: {
				'#': {
					href: '/sentiment/'
				}
			},
			stocks: {
				'#': {
					href: '/stocks/'
				}
			}
		};
		ctx.response.body = template({ nav, ...index });
	})
	.get('/sentiment/', (ctx) => {
		const body = {
			'#': {
				scripts: ['/sentiment.js'],
				editable: ['input']
			},
			input: null,
			sentiment: null
		};
		ctx.response.body = template({ nav, ...body });
	})
	.get('/stocks/', (ctx) => {
		const submitOrder = (ticker: string) => ({
			'#': {
				href: ticker + '/orders/',
				method: 'post'
			},
			quantity: 0
		});

		const body = {
			'#': {
				scripts: ['/stocks.js']
			},
			market: {
				ibm: {
					ticker: 'ACRN',
					price: (200.0 + Math.random()).toFixed(2),
					submitOrder: submitOrder('ACRN')
				},
				msft: {
					ticker: 'SCLR',
					price: (100.0 + Math.random()).toFixed(2),
					submitOrder: submitOrder('SCLR')
				}
			}
		};

		ctx.response.body = template({ nav, ...body });
	})
	.post('/stocks/:ticker/orders/', async (ctx) => {
		const body = await ctx.request.body().value;
		const data = {
			ticker: ctx.params.ticker,
			...body
		};
		ctx.response.redirect(
			`/stocks/${data.ticker}/currentOrder/?quantity=${data.quantity}`
		);
	})
	.get('/stocks/:ticker/currentOrder/', (ctx) => {
		const body = {
			'#': {
				scripts: ['/order.js']
			},
			status: 'submitted'
		};

		ctx.response.body = template({ nav, ...body });
	});

const app = new Application();

app.use(router.routes());

app.use(async (context, next) => {
	try {
		context.response.type = 'application/javascript';
		await context.send({
			root: `${Deno.cwd()}/example_server/assets`
		});
	} catch {
		await next();
	}
});

await app.listen({ port: 8000 });
