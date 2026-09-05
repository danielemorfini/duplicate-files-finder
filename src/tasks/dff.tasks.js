/**
 * Script: dff.tasks.js
 * 
 * Exports the `tasks` used in the core of the `duplicate-files-finder` app
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

import { isHidden, mapWithConcurrency } from "../utils/dff.utils.js";

/* ########################################################################## */

/**
 * Recursively scan a directory and return an array of file paths.
 * Skips unreadable entries but continues scanning.
 *
 * @param {string} root - folder path to scan
 * @returns {Promise<string[]>} - list of absolute file paths
 */
export const scan = async root => {
	const results = [];
	console.log(`Scanning folder: ${root}`);

	/**
	 * 
	 * @returns 
	 */
	const _scan = async (dir) => {
		let entries;

		try {
			entries = await fs.promises.readdir(dir, { withFileTypes: true });
		} catch (err) {
			console.warn(`[ WARNING ] : cannot read directory '${dir}': ${err.message}`);
			return;
		}

		for (const entry of entries) {
			const resolved = path.resolve(dir, entry.name);

			try {

				if (entry.isDirectory()) {
					if (isHidden(entry.name)) throw new Error('[A110] - Skipping hidden folders');
					await _scan(resolved);
				}

				if (entry.isFile()) {
					if (isHidden(entry.name)) throw new Error('[A120] - Skipping hidden files');
					results.push(resolved);
				}
			} catch (err) {
				console.warn(`[ WARNING ] : skipping '${resolved}': ${err.message}`);
			}
		}
	}

	await _scan(root);
	return results;
}

/**
 * Returns the hash corresponding to the given file
 * @param {string} filePath The file path
 * @returns
 */
export const getFileHash = async filePath => {
	return new Promise(resolve => {
		const hash = crypto.createHash('sha256');
		const stream = fs.createReadStream(filePath);

		stream.on('error', (err) => {
			console.warn(`[ WARNING ] : cannot read file '${filePath}': ${err.message}`);
			resolve(null);
		})

		stream.on('data', chunk => { hash.update(chunk) });
		stream.on('end', () => resolve(hash.digest('hex')));
	});
}

/**
 * Groups the given file paths by size, skipping files that cannot be stat'd.
 * Files with a size unique across the whole set can't have a duplicate, so
 * this lets `findDuplicates` avoid hashing them at all.
 *
 * @param {Array} files The list of file paths in the scanned directories
 * @returns {Promise<Map<number, string[]>>}
 */
const groupBySize = async files => {
	const map = new Map();

	for (const file of files) {
		let size;

		try {
			({ size } = await fs.promises.stat(file));
		} catch (err) {
			console.warn(`[ WARNING ] : cannot stat file '${file}': ${err.message}`);
			continue;
		}

		if (!map.has(size)) {
			map.set(size, []);
		}

		map.get(size).push(file);
	}

	return map;
}

/**
 * Returns a map containing the association between the file hash and its
 * duplicates paths
 *
 * Example:
 * - `<hash>` | `<file-path-00>` | `<file-path-01>` | `<file-path-N>`
 *
 * @param {Array} files The list of file paths in the scanned directories
 * @param {object} [options]
 * @param {number} [options.concurrency=8] Max number of files hashed in parallel
 * @returns
 */
export const findDuplicates = async (files, { concurrency = 8 } = {}) => {
	const map = new Map();
	const duplicates = [];

	/* GROUP BY SIZE FIRST: files with no size match can't be duplicates,
	   so they're skipped before the expensive hashing step */
	const bySize = await groupBySize(files);
	const candidates = [];
	for (const paths of bySize.values()) {
		if (paths.length > 1) candidates.push(...paths);
	}

	await mapWithConcurrency(candidates, concurrency, async file => {
		const h = await getFileHash(file);
		if (!h) return;

		if (!map.has(h)) {
			map.set(h, []);
		}

		map.get(h).push(file);
	});

	for (const paths of map.values()) {
		if (paths.length > 1) duplicates.push(paths);
	}

	return duplicates;
}

/**
 * Given a group of duplicate file paths, picks the one to keep (oldest by
 * modification time, breaking ties alphabetically for determinism) and
 * returns the rest as candidates for removal.
 *
 * @param {string[]} paths A group of duplicate file paths
 * @returns {Promise<{keep: string, remove: string[]}>}
 */
const pickKeeper = async paths => {
	const stats = await Promise.all(paths.map(async p => ({
		path: p,
		mtimeMs: (await fs.promises.stat(p)).mtimeMs,
	})));

	stats.sort((a, b) => a.mtimeMs - b.mtimeMs || a.path.localeCompare(b.path));

	const [keep, ...rest] = stats.map(s => s.path);
	return { keep, remove: rest };
}

/**
 * Resolves each duplicate group by keeping one file (the oldest) and
 * removing the rest. When `apply` is false (the default) no file is
 * touched, only the resolution plan is returned - useful for a dry run.
 *
 * @param {Array<string[]>} duplicates Groups of duplicate file paths
 * @param {object} [options]
 * @param {boolean} [options.apply=false] Actually delete the redundant files
 * @returns {Promise<Array<{keep: string, candidates: string[], removed: string[], errors: Array<{file: string, message: string}>}>>}
 */
export const resolveDuplicates = async (duplicates, { apply = false } = {}) => {
	const report = [];

	for (const group of duplicates) {
		const { keep, remove } = await pickKeeper(group);
		const removed = [];
		const errors = [];

		if (apply) {
			for (const file of remove) {
				try {
					await fs.promises.unlink(file);
					removed.push(file);
				} catch (err) {
					errors.push({ file, message: err.message });
				}
			}
		}

		report.push({ keep, candidates: remove, removed, errors });
	}

	return report;
}