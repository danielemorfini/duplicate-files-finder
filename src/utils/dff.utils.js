/**
 * Script: dff.utils.js
 * 
 * Exports a set of utilities used throughout the `duplicate-files-finder` app
 */

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
