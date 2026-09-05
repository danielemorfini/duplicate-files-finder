#!/usr/bin/env node

/**
 * Find duplicate files recursively in a given folder.
 * Usage: node index.js <folder_path> [--delete-duplicates] [--yes]
 */

import fs from "fs";
import path from "path";

import { scan, findDuplicates, resolveDuplicates } from "./tasks/dff.tasks.js";
import { toDisplayPath } from "./utils/dff.utils.js";

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
	const flags = process.argv.slice(3);
	const shouldDelete = flags.includes('--delete-duplicates');
	const confirmed = flags.includes('--yes');

	if (!folderPath) {
		console.error("Usage: node index.js <folder_path> [--delete-duplicates] [--yes]");
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
	console.table(files.map(f => toDisplayPath(_path, f)));
	console.log(`[ DONE ]`);

	console.log('');

	console.log(`Duplicates found: ${duplicates.length}`);
	console.table(duplicates.map(group => group.map(f => toDisplayPath(_path, f))));
	console.log(`[ DONE ]`);

	console.log('');

	/* RESOLVE DUPLICATES (OPTIONAL) */
	if (shouldDelete && duplicates.length > 0) {
		console.log(confirmed
			? 'Deleting duplicates (keeping the oldest copy per group)...'
			: 'Dry run: showing what would be deleted (re-run with --yes to actually delete)'
		);

		const report = await resolveDuplicates(duplicates, { apply: confirmed });

		console.table(report.map(r => ({
			keep: toDisplayPath(_path, r.keep),
			[confirmed ? 'removed' : 'would_remove']: (confirmed ? r.removed : r.candidates)
				.map(f => toDisplayPath(_path, f))
				.join(', '),
			errors: r.errors.map(e => `${toDisplayPath(_path, e.file)}: ${e.message}`).join(', ') || '-',
		})));

		console.log(`[ DONE ]`);
		console.log('');
	}

	console.log('################################################################################');
	console.log('#### SCRIPT STOPPING');
	console.log('################################################################################');
	console.log('');
}

main().catch((err) => console.error(err));