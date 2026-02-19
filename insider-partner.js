/*
 * Insider "partner"-class pattern
 * (Shared #insider state across base + trusted (but unrelated) partner-classes)
 * Follows sub-class pattern with a couple of small changes
 *
 * Last modified: 2026-02-18
 * Author: Brian Katzung <briank@kappacs.com>
 */

import { Base } from './insider-trusted.js';

export const Partner = (() => {
	const cls = Object.freeze(class Partner { // ** Unrelated to Base **
		static #insiderBaton;
		#insider;

		constructor (baseInstance) {
			// Accept base instance parameter instead of using `this`
			Base._getInsider(cls, baseInstance, () => this.#insider = cls.#insiderBaton);
			// Insider properties (this.#insider.prop) now available here
		}

		/**
		 * Standard handoff-pattern class-method
		 * (called by Base._getInsider if trusted)
		 * @param {Object} insider - The requested instance's #insider
		 * @param {Function} receiver - The receiver function to call
		 */
		static _passInsider (insider, receiver) {
			this.#insiderBaton = insider;
			receiver();
			this.#insiderBaton = null;
		}

		/**
		 * OPTIONAL cross-instance #insider access
		 * @param {Partner|Base} other - The instance for which #insider is requested
		 * @returns {Object} The other instance's #insider state object
		 */
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
