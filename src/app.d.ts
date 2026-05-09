/// <reference types="@cloudflare/workers-types" />
import type { User, Session } from 'better-auth/minimal';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user?: User;
			session?: Session;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env?: {
				MODEL_CACHE?: KVNamespace;
				R2?: R2Bucket;
			};
		}
	}
}

export {};
