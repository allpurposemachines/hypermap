setInterval(() => {
	hypermap.at('market').forEach(stock => {
		const prevPrice = stock.at('price');
		const newPrice = prevPrice + (Math.random() * 10) - 5;
		stock.set('price', newPrice);
	});
}, 2000);
