/*
 * "Insider" base-class pattern
 * (Shared #$ (insider) state across base + trusted sub-classed)
 *
 * Last modified: 2026-03-24
 * Author: Brian Katzung <briank@kappacs.com>
 */

import { isTrusted } from './insider-trusted.js';

export const Base = (() => {
	// NOTE: Object.* security here is all performative unless you own the
	// context and Object.freeze(Object) before any untrusted code can run!
	const cls = Object.freeze(class Base {
		static #insiderBaton = null; // Per-class handoff baton
		static #__insider = Object.freeze({
			insiderMethod () {
				const [thys, $thys] = [this.__this, this];
				// When called as `this.#$.method` (or `insider.method`):
				// `this` is the insider state object
				// `this.__this` is the original object (see constructor)
				if ($thys !== thys.#$) throw new Error('Unauthorized');
				// ...
			}
		});

		#$; /* Instance insider properties */

		constructor () {
			const insider = this.#$ = Object.create(cls.#__insider);
			insider.__this = this; // Enables insider methods without per-instance binding
		}

		/*
		 * Base-class-only class-method to pass #$ access
		 * @param {Class} reqCls - The requesting method's class (for proper handoff)
		 * @param {Object} instance - The instance whose #$ is requested
		 * @param {Function} receiver - Baton-receiver/instance-#$-setter function
		 */
		static _get$ (reqCls, instance, receiver) {
			// Request must be for a class on the trusted list
			if (!isTrusted(reqCls)) throw new Error('Untrusted request');
			// Make sure the handoff class-method is a frozen function
			const passProps = Object.getOwnPropertyDescriptor(reqCls, '_pass$');
			if (typeof passProps.value !== 'function' || passProps.writable !== false || passProps.configurable !== false) throw new Error('Unsafe handoff');
			// Use the supplied class-level handoff method to pass #$ to the receiver
			reqCls._pass$(instance.#$, receiver);
		}

		callSampleMethod () {
			this.#$.sampleMethod();
		}

		// OPTIONAL: Get another instance's #$
		// (base-class version)
		#get$For (other) {
			// Use native JS cross-instance private #$ access
			if (other instanceof cls) return other.#$;
		}
	});
	Object.freeze(cls.prototype);
	return cls;
})();
