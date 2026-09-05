import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { scan, getFileHash, findDuplicates, resolveDuplicates } from "../src/tasks/dff.tasks.js";

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

const setMtime = (filePath, date) => fs.utimesSync(filePath, date, date);

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

describe("resolveDuplicates", () => {
	test("dry run: keeps the oldest file and reports the rest as candidates, deleting nothing", async () => {
		const older = writeFile("a.txt", "dup");
		const newer = writeFile("nested/b.txt", "dup");
		setMtime(older, new Date(2020, 0, 1));
		setMtime(newer, new Date(2021, 0, 1));

		const duplicates = await findDuplicates(await scan(tmpDir));
		const report = await resolveDuplicates(duplicates);

		assert.equal(report.length, 1);
		assert.equal(report[0].keep, older);
		assert.deepEqual(report[0].candidates, [newer]);
		assert.deepEqual(report[0].removed, []);
		assert.deepEqual(report[0].errors, []);
		assert.ok(fs.existsSync(newer), "dry run must not delete any file");
	});

	test("apply: deletes every file in the group except the oldest", async () => {
		const older = writeFile("a.txt", "dup");
		const newer1 = writeFile("nested/b.txt", "dup");
		const newer2 = writeFile("nested/deeper/c.txt", "dup");
		setMtime(older, new Date(2020, 0, 1));
		setMtime(newer1, new Date(2021, 0, 1));
		setMtime(newer2, new Date(2022, 0, 1));

		const duplicates = await findDuplicates(await scan(tmpDir));
		const report = await resolveDuplicates(duplicates, { apply: true });

		assert.equal(report.length, 1);
		assert.equal(report[0].keep, older);
		assert.deepEqual(report[0].removed.sort(), [newer1, newer2].sort());
		assert.deepEqual(report[0].errors, []);

		assert.ok(fs.existsSync(older), "the oldest file must survive");
		assert.ok(!fs.existsSync(newer1));
		assert.ok(!fs.existsSync(newer2));
	});

	test("breaks ties on identical mtimes alphabetically", async () => {
		const a = writeFile("a.txt", "dup");
		const z = writeFile("z.txt", "dup");
		const sameDate = new Date(2020, 0, 1);
		setMtime(a, sameDate);
		setMtime(z, sameDate);

		const duplicates = await findDuplicates(await scan(tmpDir));
		const report = await resolveDuplicates(duplicates);

		assert.equal(report[0].keep, a);
		assert.deepEqual(report[0].candidates, [z]);
	});

	test("records a per-file error and keeps going when a delete fails", async () => {
		const keep = writeFile("keep.txt", "dup");
		const blocked = writeFile("locked/blocked.txt", "dup");
		setMtime(keep, new Date(2020, 0, 1));
		setMtime(blocked, new Date(2021, 0, 1));

		/* removes write permission on the parent dir so unlink() fails on
		   'blocked' while stat()/readdir() (which only need read+exec) still
		   succeed - simulates a delete failing without aborting the run */
		const lockedDir = path.dirname(blocked);
		fs.chmodSync(lockedDir, 0o500);

		try {
			const duplicates = await findDuplicates(await scan(tmpDir));
			const report = await resolveDuplicates(duplicates, { apply: true });

			assert.equal(report.length, 1);
			assert.equal(report[0].keep, keep);
			assert.deepEqual(report[0].removed, []);
			assert.equal(report[0].errors.length, 1);
			assert.equal(report[0].errors[0].file, blocked);
			assert.ok(fs.existsSync(blocked), "blocked file must not have been deleted");
		} finally {
			fs.chmodSync(lockedDir, 0o700);
		}
	});
});
