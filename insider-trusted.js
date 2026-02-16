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
import { Partner } from './insider-partner.js';
import { Sub } from './insider-sub.js';
export { Base, Partner, Sub };

/*
 * List of trusted classes.
 * Populated on first use (after classes are initialized).
 * @type {Array|Set|undefined}
 */
let trusted;

/**
 * Is a class on the trusted list?
 * @param {Class} cls - The class object in question
 * @returns {boolean} Whether the class is on the trusted list
 */
export const isTrusted = (cls) => {
	// Adjust the trusted-class array (or Set) below as required
	trusted ||= [Sub, Partner]; // (Array) ideally, most common first
	// trusted ||= new Set([...]); // (Set) more performant for long lists
	return trusted.includes(cls); // trusted.has(cls) if using a Set
};
