/*
 * "Insider" sub-class pattern
 * (Shared #insider state across base + trusted sub-classes)
 * **Identical to partner-class pattern except base instance is `this`**
 *
 * Last modified: 2026-02-13
 * Author: Brian Katzung <briank@kappacs.com>
 */

 import { Base } from './insider-trusted.js';

 const getProto = Object.getPrototypeOf, setProto = Object.setPrototypeOf;

 export const Sub = (() => {
	const cls = Object.freeze(class Sub extends Base {
		static #insiderBaton = null; // Handoff baton
		static #protoInsider = setProto({
			insiderMethod () {
				// When called as `this.#insider.method` (or `insider.method`):
				// `this` is the insider state object
				// `this.thys` is the original object (see constructor)
				if (this !== this.thys.#insider) throw new Error('Unauthorized call');
				// super.insiderMethod();
			}
		}, null);
		#insider; // Per-class-level private view of shared #insider state

		constructor () {
			super();
			// Request this instance's #insider using our class-level static handoff method
			// and a receiver that loads the instance #insider from the static baton
			Base._getInsider(cls, this, () => this.#insider = cls.#insiderBaton);
			const insider = this.#insider;
			// Fix #insider prototypes
			if (!getProto(cls.#protoInsider)) Object.freeze(setProto(cls.#protoInsider, getProto(insider)));
			setProto(insider, cls.#protoInsider);
			// console.log('Sub insider', insider);
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
			try { receiver(); } // Receiver must be a cls method to accept the baton
			finally { cls.#insiderBaton = null; }
		}

		// OPTIONAL: Get another instance's #insider
		// (sub-class version)
		#getInsiderFor (other) {
			// Same class: use native JS cross-instance private #insider access
			if (other instanceof cls) return other.#insider;
			
			// instanceof Base (cross-class cross-instance): use Base._getInsider
			if (other instanceof Base) {
				let insider;
				Base._getInsider(cls, other, () => insider = cls.#insiderBaton);
				return insider;
			}
		}
	});
	Object.freeze(cls.prototype);
	return cls;
 })();
