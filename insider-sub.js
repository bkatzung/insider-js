/*
 * "Insider" sub-class pattern
 * (Shared #insider state across base + trusted sub-classed)
 *
 * Last modified: 2026-02-13
 * Author: Brian Katzung <briank@kappacs.com>
 */

 import { Base } from './insider-trusted.js';

 export const Sub = (() => {
	const cls = Object.freeze(class Sub extends Base {
		static #insiderBaton = null; // Handoff baton
		#insider; // Per-class-level private view of shared #insider state

		constructor () {
			super();
			// Request this instance's #insider using our class-level static handoff method
			// and a receiver that loads the instance #insider from the static baton
			Base._getInsider(cls, this, () => this.#insider = cls.#insiderBaton);
			// console.log('Sub insider', this.#insider);
		}

		/*
		 * Baton handoff function (all sub-classes)
		 * (called by Base._getInsider if trusted)
		 * @param {Object} insider - The requested instance's #insider
		 * @param {Function} receiver - The receiver function to call
		 */
		static _passInsider (insider, receiver) {
			/*
			 * Put the instance's #insider into the baton long enough
			 * for the handoff and then remove it.
			 */
			cls.#insiderBaton = insider;
			receiver(); // Receiver must be a cls method to accept the baton
			cls.#insiderBaton = null;
		}

		// OPTIONAL: Two ways to get another instance's #insider
		#getOtherInsider (other) {
			// #1: Only works if other instanceof cls (at least as derived in same hierarchy, e.g. Base)
			const insider1 = other.#insider;
			// return insider1;
			// #2: Works for any instance (if called from a trusted-sub-class method)
			let insider2;
			Base._getInsider(cls, other, () => insider2 = cls.#insiderBaton);
			// return insider2;
		}
	});
	Object.freeze(cls.prototype);
	return cls;
 })();
