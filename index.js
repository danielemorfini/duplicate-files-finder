#!/usr/bin/env node

/**
 * Find duplicate files recursively in a given folder.
 * Usage: node index.js <folder_path>
 */

import fs from "fs";
import path from "path";

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

		try
		{
			entries = await fs.promises.readdir(dir, { withFileTypes: true });
		} catch (err) {
			console.warn(`[ WARNING ] : cannot read directory '${dir}': ${err.message}`);
			return;
		}

		for (const entry of entries) {
			const resolved = path.resolve(dir, entry.name);

			try
			{
				if (entry.isDirectory()) {
					await _scan(resolved);
				}

				if (entry.isFile()) {
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

	console.log(`Files found: ${files.length}`);
	console.table(files);
	console.log(`[ DONE ]`);

	console.log('');
	console.log('################################################################################');
	console.log('#### SCRIPT STOPPING');
	console.log('################################################################################');
	console.log('');
}

main().catch((err) => console.error(err));