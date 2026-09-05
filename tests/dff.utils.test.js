import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { isHidden, mapWithConcurrency } from "../src/utils/dff.utils.js";

describe("isHidden", () => {
	test("returns true for dotfiles", () => {
		assert.equal(isHidden(".gitignore"), true);
		assert.equal(isHidden(".git"), true);
	});

	test("returns false for regular names", () => {
		assert.equal(isHidden("index.js"), false);
		assert.equal(isHidden("folder"), false);
	});
});

describe("mapWithConcurrency", () => {
	test("preserves input order regardless of resolution order", async () => {
		const items = [30, 10, 20];
		const results = await mapWithConcurrency(items, 3, async ms => {
			await new Promise(resolve => setTimeout(resolve, ms));
			return ms;
		});

		assert.deepEqual(results, [30, 10, 20]);
	});

	test("never runs more than `concurrency` calls at once", async () => {
		let active = 0;
		let maxActive = 0;

		await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async item => {
			active++;
			maxActive = Math.max(maxActive, active);
			await new Promise(resolve => setTimeout(resolve, 5));
			active--;
			return item;
		});

		assert.ok(maxActive <= 2, `expected at most 2 concurrent calls, got ${maxActive}`);
	});

	test("returns an empty array for an empty input", async () => {
		const results = await mapWithConcurrency([], 4, async item => item);
		assert.deepEqual(results, []);
	});
});
