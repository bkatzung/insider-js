/*
 * "Insider" trust-declaration pattern
 * (For shared #insider state across base + trusted sub-classes)
 *
 * This file allows you to adjust the trusted sub-classes list for
 * different deployments (applications) without changing the module
 * code.
 *
 * Last modified: 2026-02-13
 * Author: Brian Katzung <briank@kappacs.com>
 */

// "Barrel" bundling of base + trusted sub-classes
import { Base } from './insider-base.js';
import { Sub } from './insider-sub.js';
export { Base, Sub };

let trusted;

// Return the trusted sub-class list
// (but not before the classes are initialized)
export const getTrusted = () => {
	// Adjust the trusted-class array below as required
	trusted ||= Object.freeze([Sub]);
	return trusted;
};
