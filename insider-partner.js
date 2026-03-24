/*
 * Insider "partner"-class pattern
 * (Shared #$ (insider) state across base + trusted (but unrelated) partner-classes)
 * (Similar to sub-class pattern, but constructor takes a base instance)
 *
 * Last modified: 2026-02-18
 * Author: Brian Katzung <briank@kappacs.com>
 */

import { Base } from './insider-trusted.js';

export const Partner = (() => {
	const cls = Object.freeze(class Partner { // ** Unrelated to Base **
		static #insiderBaton;
		#$;

		constructor (baseInstance) {
			// Accept base instance parameter instead of using `this`
			Base._get$(cls, baseInstance, () => this.#$ = cls.#insiderBaton);
			// Insider properties (this.#$.prop) now available here
		}

		/**
		 * Standard handoff-pattern class-method
		 * (called by Base._get$ if trusted)
		 * @param {Object} insider - The requested instance's #$
		 * @param {Function} receiver - The receiver function to call
		 */
		static _pass$ (insider, receiver) {
			cls.#insiderBaton = insider;
			try { receiver(); }
			finally { cls.#insiderBaton = null; }
		}

		/**
		 * OPTIONAL cross-instance #$ access
		 * @param {Partner|Base} other - The instance for which #$ is requested
		 * @returns {Object} The other instance's #$ state object
		 */
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

		/**
		 * Pseudo-insider method (public, but caller must confirm it knows #$)
		 * partnerInstance.gatedMethod(this.#$)
		 * @param {*} insider - The insider-properties object
		 */
		gatedMethod (insider) {
			if (insider !== this.#$) throw new Error('Unauthorized');
		}
	});
	Object.freeze(cls.prototype);
	return cls;
})();
