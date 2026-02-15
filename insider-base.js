/*
 * "Insider" base-class pattern
 * (Shared #insider state across base + trusted sub-classed)
 *
 * Last modified: 2026-02-13
 * Author: Brian Katzung <briank@kappacs.com>
 */

import { getTrusted } from './insider-trusted.js';

export const Base = (() => {
	// NOTE: Object.* security here is all performative unless you own the
	// context and Object.freeze(Object) before any untrusted code can run!
	const cls = Object.freeze(class Base {
		static #trusted; // Base-class cached trusted-sub-class array
		static #insiderBaton = null; // Per-class handoff baton
		#insider = { /* insider: true /* Instance insider properties */ };

		// Base-class constructor
		constructor () {
			// Cache trusted sub-class list upon first instantiation
			cls.#trusted ||= getTrusted();
		}

		/*
		 * Base-class-only class-method to pass #insider access
		 * @param {Class} reqCls - The requesting method's class (for proper handoff)
		 * @param {Object} instance - The instance whose #insider is requested
		 * @param {Function} receiver - Baton-receiver/instance-#insider-setter function
		 */
		static _getInsider (reqCls, instance, receiver) {
			// Request must be for a class on the trusted list
			if (!cls.#trusted.includes(reqCls)) throw new Error('Untrusted request');
			// Make sure the handoff class-method is a frozen function
			const passProps = Object.getOwnPropertyDescriptor(reqCls, '_passInsider');
			if (typeof passProps.value !== 'function' || passProps.writable !== false || passProps.configurable !== false) throw new Error('Unsafe handoff');
			// Use the supplied class-level handoff method to pass #insider to the receiver
			reqCls._passInsider(instance.#insider, receiver);
		}

		// OPTIONAL: Get another instance's #insider
		// (base-class version)
		#getInsiderFor (other) {
			// Use native JS cross-instance private #insider access
			if (other instanceof cls) return other.#insider;
		}
	});
	Object.freeze(cls.prototype);
	return cls;
})();
