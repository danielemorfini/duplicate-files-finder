/**
 * Script: dff.utils.js
 *
 * Exports a set of utilities used throughout the `duplicate-files-finder` app
 */

import path from "path";

/* ########################################################################## */

/**
 * Returns a boolean based on the fact that the provided resource name starts
 * with the '.' character, meaning it's a hidden resource
 * @param {string} resource The resource name
 * @returns {bool}
 */
export const isHidden = resource => {
	return resource.startsWith('.');
}

/**
 * Runs `fn` over `items` with at most `concurrency` calls in flight at once,
 * preserving the input order in the returned array.
 * @param {Array} items The items to process
 * @param {number} concurrency Max number of concurrent `fn` calls
 * @param {Function} fn `(item, index) => Promise`
 * @returns {Promise<Array>}
 */
export const mapWithConcurrency = async (items, concurrency, fn) => {
	const results = new Array(items.length);
	let next = 0;

	const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
		while (next < items.length) {
			const index = next++;
			results[index] = await fn(items[index], index);
		}
	});

	await Promise.all(workers);
	return results;
}

/**
 * Formats an absolute file path for display, replacing `basePath` with the
 * `$basePath` token so reports read as paths relative to the scanned folder.
 * @param {string} basePath The scanned root folder (absolute path)
 * @param {string} filePath An absolute file path under `basePath`
 * @returns {string}
 */
export const toDisplayPath = (basePath, filePath) => {
	const relative = path.relative(basePath, filePath);
	return relative ? `$basePath${path.sep}${relative}` : '$basePath';
}
