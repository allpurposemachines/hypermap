import Sentiment from 'https://esm.sh/sentiment';

hypermap.at('input').addEventListener('changed', () => {
	const inputText = hypermap.at('input', 'text');
	const sentiment = sentimentAsText(inputText);
	hypermap.set('sentiment', sentiment);
});

function sentimentAsText(input) {
	const sentiment = new Sentiment();
	const sentimentScore = sentiment.analyze(input).comparative;
	if (sentimentScore > 0.1) {
		return 'pos';
	} else if (sentimentScore < -0.1) {
		return 'neg';
	} else {
		return 'neut'
	}
}
