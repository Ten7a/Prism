import { seedPacks } from '../src/lib/server/db/seed-packs';

seedPacks()
	.then(() => {
		console.log('Seeded token packs.');
		process.exit(0);
	})
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
