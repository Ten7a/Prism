type Labels = Record<string, string | number>;

function labelKey(labels?: Labels): string {
	if (!labels) return '';
	const entries = Object.entries(labels)
		.filter(([, v]) => v !== undefined && v !== null)
		.map(([k, v]) => [k, String(v)] as [string, string])
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
	return entries.map(([k, v]) => `${k}=${v}`).join(',');
}

function escapeLabelValue(v: string): string {
	return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function renderLabels(key: string): string {
	if (!key) return '';
	const parts = key.split(',').map((kv) => {
		const idx = kv.indexOf('=');
		const k = kv.slice(0, idx);
		const v = kv.slice(idx + 1);
		return `${k}="${escapeLabelValue(v)}"`;
	});
	return `{${parts.join(',')}}`;
}

interface Metric {
	name: string;
	type: 'counter' | 'histogram';
}

class Registry {
	private counters = new Map<string, number>(); // key: name|labelKey
	private histograms = new Map<string, { buckets: number[]; counts: number[]; sum: number; count: number; labelKey: string }>(); // key: name|labelKey
	private metrics = new Map<string, Metric>();

	incCounter(name: string, labels?: Labels, by = 1): void {
		this.metrics.set(name, { name, type: 'counter' });
		const key = `${name}|${labelKey(labels)}`;
		this.counters.set(key, (this.counters.get(key) ?? 0) + by);
	}

	observe(name: string, value: number, labels?: Labels, buckets?: number[]): void {
		this.metrics.set(name, { name, type: 'histogram' });
		const lk = labelKey(labels);
		const key = `${name}|${lk}`;
		let h = this.histograms.get(key);
		if (!h) {
			h = {
				buckets: (buckets ?? [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]).slice(),
				counts: new Array((buckets ?? [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]).length).fill(0),
				sum: 0,
				count: 0,
				labelKey: lk
			};
			this.histograms.set(key, h);
		}
		for (let i = 0; i < h.buckets.length; i++) if (value <= h.buckets[i]) h.counts[i]++;
		h.sum += value;
		h.count++;
	}

	renderProm(): string {
		const lines: string[] = [];
		const byName = new Map<string, Metric>();
		for (const m of this.metrics.values()) byName.set(m.name, m);
		const sortedNames = [...byName.keys()].sort();
		for (const name of sortedNames) {
			const m = byName.get(name)!;
			lines.push(`# TYPE ${name} ${m.type}`);
			if (m.type === 'counter') {
				for (const [key, val] of this.counters) {
					const [n, lk] = splitKey(key);
					if (n !== name) continue;
					lines.push(`${name}${renderLabels(lk)} ${val}`);
				}
			} else {
				for (const [key, h] of this.histograms) {
					const [n] = splitKey(key);
					if (n !== name) continue;
					const baseLabels = h.labelKey;
					let cumulative = 0;
					for (let i = 0; i < h.buckets.length; i++) {
						cumulative = h.counts[i];
						const lk = mergeLabels(baseLabels, `le=${h.buckets[i]}`);
						lines.push(`${name}_bucket${renderLabels(lk)} ${cumulative}`);
					}
					lines.push(`${name}_bucket${renderLabels(mergeLabels(baseLabels, 'le=+Inf'))} ${h.count}`);
					lines.push(`${name}_sum${renderLabels(baseLabels)} ${h.sum}`);
					lines.push(`${name}_count${renderLabels(baseLabels)} ${h.count}`);
				}
			}
		}
		return lines.join('\n') + '\n';
	}

	reset(): void {
		this.counters.clear();
		this.histograms.clear();
		this.metrics.clear();
	}
}

function splitKey(key: string): [string, string] {
	const i = key.indexOf('|');
	return [key.slice(0, i), key.slice(i + 1)];
}

function mergeLabels(a: string, b: string): string {
	if (!a) return b;
	if (!b) return a;
	return [...a.split(','), b].sort().join(',');
}

export const registry = new Registry();

export function incCounter(name: string, labels?: Labels, by = 1): void {
	registry.incCounter(name, labels, by);
}

export function observe(name: string, value: number, labels?: Labels, buckets?: number[]): void {
	registry.observe(name, value, labels, buckets);
}
