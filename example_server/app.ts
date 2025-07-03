import { _common } from 'https://jsr.io/@std/path/0.210.0/_common/common.ts';
import {
	Application,
	Router
} from 'jsr:@oak/oak@12.6.3';

const router = new Router();

function template(body: unknown) {
	return `<!DOCTYPE html>
		<html>
			<head>
				<title>HyperMap Demo!</title>
				<script type="module" src="https://cdn.jsdelivr.net/npm/@allpurposemachines/hypermap-shim@0.4.0/+esm"></script>
			<head>
			<body>
				<pre>${JSON.stringify(body)}</pre>
			</body>
		</html>
	`;
}

const nav = {
	home: {
		'#': {
			href: 'https://localhost:4001/'
		}
	}
};

router
	.get('/', ctx => {
		const index = {
			sentimentAnalysisLocal: {
				'#': {
					href: 'https://localhost:4001/sentiment/'
				}
			},
			stocks: {
				'#': {
					href: 'https://localhost:4001/stocks/'
				}
			}
		};
		ctx.response.body = template({ nav, ...index });
	})
	.get('/sentiment/', ctx => {
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
	.get('/stocks/', ctx => {
		const submitOrder = (ticker: string) => ({
			'#': {
				href: 'https://localhost:4001/' + ticker + '/order/',
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
					ticker: 'IBM',
					price: (100.0 + Math.random()).toFixed(2),
					submitOrder: submitOrder('IBM')
				},
				msft: {
					ticker: 'MSFT',
					price: (200.0 + Math.random()).toFixed(2),
					submitOrder: submitOrder('MSFT')
				}
			}
		};

		ctx.response.body = template({ nav, ...body });
	})
	.post('/stocks/:ticker/order/', async ctx => {
		const body = await ctx.request.body().value;
		const data = {
			ticker: ctx.params.ticker, ...body
		};
		ctx.response.redirect(`/stocks/${data.ticker}/purchased/?quantity=${data.quantity}`);
	})
	.get('/stocks/:ticker/purchased/', ctx => {
		const body = {
			'#': {
				scripts: ['/order.js']
			},
			status: 'submitted'
		};

		ctx.response.body = template({ nav, ...body });
	})
	.get('/vscode_redirect/', ctx => {
		ctx.response.redirect('vscode://all-purpose-machines.apm-explorer/foo?uri=https%3A%2F%2Fservices.allpurposemachines.com%2F');
	});

const app = new Application();

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
