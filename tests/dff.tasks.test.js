import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { scan, getFileHash, findDuplicates } from "../src/tasks/dff.tasks.js";

/* ########################################################################## */

let tmpDir;

beforeEach(async () => {
	tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "dff-test-"));
});

afterEach(async () => {
	await fs.promises.rm(tmpDir, { recursive: true, force: true });
});

const writeFile = (relPath, content) => {
	const full = path.join(tmpDir, relPath);
	fs.mkdirSync(path.dirname(full), { recursive: true });
	fs.writeFileSync(full, content);
	return full;
}

/* ########################################################################## */

describe("scan", () => {
	test("finds files recursively and skips hidden files/folders", async () => {
		writeFile("a.txt", "a");
		writeFile("nested/b.txt", "b");
		writeFile(".hidden-file", "secret");
		writeFile(".hidden-folder/c.txt", "c");

		const files = await scan(tmpDir);
		const relative = files.map(f => path.relative(tmpDir, f)).sort();

		assert.deepEqual(relative, ["a.txt", path.join("nested", "b.txt")]);
	});
});

describe("getFileHash", () => {
	test("same content produces the same hash", async () => {
		const fileA = writeFile("a.txt", "hello world");
		const fileB = writeFile("b.txt", "hello world");

		assert.equal(await getFileHash(fileA), await getFileHash(fileB));
	});

	test("different content produces a different hash", async () => {
		const fileA = writeFile("a.txt", "hello world");
		const fileB = writeFile("b.txt", "goodbye world");

		assert.notEqual(await getFileHash(fileA), await getFileHash(fileB));
	});

	test("resolves to null for a missing file", async () => {
		const missing = path.join(tmpDir, "does-not-exist.txt");
		assert.equal(await getFileHash(missing), null);
	});
});

describe("findDuplicates", () => {
	test("groups files with identical content", async () => {
		const a = writeFile("a.txt", "same content");
		const b = writeFile("nested/b.txt", "same content");
		writeFile("c.txt", "unique content");

		const duplicates = await findDuplicates(await scan(tmpDir));

		assert.equal(duplicates.length, 1);
		assert.deepEqual(duplicates[0].sort(), [a, b].sort());
	});

	test("does not flag files that merely share a size", async () => {
		const a = writeFile("a.txt", "aa");
		const b = writeFile("b.txt", "bb");

		const duplicates = await findDuplicates(await scan(tmpDir));

		assert.deepEqual(duplicates, []);
		assert.notEqual(await getFileHash(a), await getFileHash(b));
	});

	test("returns no duplicates when all files are unique", async () => {
		writeFile("a.txt", "one");
		writeFile("b.txt", "two two");
		writeFile("c.txt", "three three three");

		const duplicates = await findDuplicates(await scan(tmpDir));
		assert.deepEqual(duplicates, []);
	});

	test("supports more than two files sharing the same content", async () => {
		const a = writeFile("a.txt", "shared");
		const b = writeFile("b.txt", "shared");
		const c = writeFile("nested/c.txt", "shared");

		const duplicates = await findDuplicates(await scan(tmpDir));

		assert.equal(duplicates.length, 1);
		assert.deepEqual(duplicates[0].sort(), [a, b, c].sort());
	});
});
