import Sentiment from 'https://esm.sh/sentiment';

hypermap.at('input').addEventListener('changed', () => {
	let sentiment = 'neut';
	const inputText = hypermap.at('input', 'text');
	const sentimentScore = new Sentiment().analyze(inputText).comparative;
	if (sentimentScore > 0.1) {
		sentiment = 'pos';
	} else if (sentimentScore < -0.1) {
		sentiment = 'neg';
	}
	hypermap.set('sentiment', sentiment);
});
