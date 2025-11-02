#!/usr/bin/env node

/**
 * Find duplicate files recursively in a given folder.
 * Usage: node index.js <folder_path>
 */

import fs from "fs";
import path from "path";

import { scan } from "./tasks/dff.tasks.js";
import { findDuplicates } from "./tasks/dff.tasks.js";

/* ########################################################################## */

/**
 * Main function of the `duplicate-files-finder` application
 */
async function main() {

	console.log('');
	console.log('################################################################################');
	console.log('#### SCRIPT [ duplicate-files-finder ] STARTING');
	console.log('################################################################################');
	console.log('');

	/* VALIDATES FOLDER */
	const folderPath = process.argv[2];

	if (!folderPath) {
		console.error("Usage: node index.js <folder_path>");
		process.exit(1);
	}

	if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
		console.error(`Error: '${folderPath}' is not a valid directory.`);
		process.exit(1);
	}


	/* START SCANNING FOLDERS & FILES */
	const _path = path.resolve(folderPath);
	const files = await scan(_path);
	const duplicates = await findDuplicates(files);


	/* OUTPUT RESULTS */
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