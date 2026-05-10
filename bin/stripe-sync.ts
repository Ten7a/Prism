import { syncPrices } from '../src/lib/server/stripe/sync-prices';

syncPrices()
	.then(() => {
		console.log('Synced PACKS into Stripe and token_pack.');
		process.exit(0);
	})
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
