#!/usr/bin/env node

/**
 * Find duplicate files recursively in a given folder.
 * Usage: node index.js <folder_path>
 */

import fs from "fs";
import path, { resolve } from "path";
import crypto, { hash } from "crypto";

/* ########################################################################## */
/* #### UTILITIES ########################################################### */
/* ########################################################################## */

/**
 * Returns a boolean based on the fact that the provided resource name starts
 * with the '.' character, meaning it's a hidden resource
 * @param {string} resource The resource name
 * @returns {bool}
 */
function isHidden(resource) {
	return resource.startsWith('.');
}

/* ########################################################################## */
/* #### TASKS ############################################################### */
/* ########################################################################## */

/**
 * Recursively scan a directory and return an array of file paths.
 * Skips unreadable entries but continues scanning.
 *
 * @param {string} root - folder path to scan
 * @returns {Promise<string[]>} - list of absolute file paths
 */
async function scan(root) {
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
async function getFileHash(filePath) {
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
 * Returns a map containing the association between the file hash and its
 * duplicates paths
 * 
 * Example:
 * - `<hash>` | `<file-path-00>` | `<file-path-01>` | `<file-path-N>`
 *
 * @param {Array} files The list of file paths in the scanned directories
 * @returns 
 */
async function findDuplicates(files) {
	const map = new Map();
	const duplicates = [];

	for (const file of files) {
		const h = await getFileHash(file);
		if (!h) continue;

		if (!map.has(h)) {
			map.set(h, []);
		}

		map.get(h).push(file);
	}

	for (const paths of map.values()) {
		if (paths.length > 1) duplicates.push(paths);
	}

	return duplicates;
}

/* ########################################################################## */
/* #### MAIN ################################################################ */
/* ########################################################################## */

async function main() {

	console.log('');
	console.log('################################################################################');
	console.log('#### SCRIPT [ duplicate-files-finder ] STARTING');
	console.log('################################################################################');
	console.log('');

	const folderPath = process.argv[2];

	if (!folderPath) {
		console.error("Usage: node index.js <folder_path>");
		process.exit(1);
	}

	if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
		console.error(`Error: '${folderPath}' is not a valid directory.`);
		process.exit(1);
	}

	const _path = path.resolve(folderPath);
	const files = await scan(_path);
	const duplicates = await findDuplicates(files);

	console.log(`Files found: ${files.length}`);
	console.table(files);
	console.log(`[ DONE ]`);

	console.log('');

	console.log(`Duplicates found: ${duplicates.length}`);
	console.table(duplicates);
	console.log(`[ DONE ]`);

	console.log('');
	console.log('################################################################################');
	console.log('#### SCRIPT STOPPING');
	console.log('################################################################################');
	console.log('');
}

main().catch((err) => console.error(err));