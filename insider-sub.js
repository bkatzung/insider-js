/*
 * "Insider" sub-class pattern
 * (Shared #$ (insider) state across base + trusted sub-classes)
 * **Identical to partner-class pattern except base instance is `this`**
 *
 * Last modified: 2026-03-24
 * Author: Brian Katzung <briank@kappacs.com>
 */

 import { Base } from './insider-trusted.js';

 const getProto = Object.getPrototypeOf, setProto = Object.setPrototypeOf;

 export const Sub = (() => {
	const cls = Object.freeze(class Sub extends Base {
		static #insiderBaton = null; // Handoff baton
		static #__insider = setProto({
			insiderMethod () {
				const [thys, $thys] = [this.__this, this];
				// When called as `this.#$.method` (or `insider.method`):
				// `this` is the insider state object
				// `this.__this` is the original object (see constructor)
				if ($thys !== thys.#$) throw new Error('Unauthorized');
				// super.insiderMethod();
			}
		}, null);

		#$; // Per-class-level private view of shared #$ state

		constructor () {
			super();
			// Request this instance's #$ using our class-level static handoff method
			// and a receiver that loads the instance #$ from the static baton
			Base._get$(cls, this, () => this.#$ = cls.#insiderBaton);
			const insider = this.#$, protoInsider = cls.#__insider;
			// Fix #$ prototypes
			if (!getProto(protoInsider)) Object.freeze(setProto(protoInsider, getProto(insider)));
			setProto(insider, protoInsider);
			// console.log('Sub insider', insider);
		}

		/*
		 * Baton handoff function (all sub-classes)
		 * (called by Base._get$ if trusted)
		 * @param {Object} insider - The requested instance's #$
		 * @param {Function} receiver - The receiver function to call
		 */
		static _pass$ (insider, receiver) {
			/*
			 * Put the instance's #$ into the baton long enough
			 * for the handoff and then remove it.
			 */
			cls.#insiderBaton = insider;
			try { receiver(); } // Receiver must be a cls method to accept the baton
			finally { cls.#insiderBaton = null; }
		}

		// OPTIONAL: Get another instance's #$
		// (sub-class version)
		#get$For (other) {
			// Same class: use native JS cross-instance private #$ access
			if (other instanceof cls) return other.#$;
			
			// instanceof Base (cross-class cross-instance): use Base._get$
			if (other instanceof Base) {
				let insider;
				Base._get$(cls, other, () => insider = cls.#insiderBaton);
				return insider;
			}
		}
	});
	Object.freeze(cls.prototype);
	return cls;
 })();
