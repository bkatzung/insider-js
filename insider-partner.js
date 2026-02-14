// Assuming Partner is in the Base's trusted-class list
// Follows sub-class pattern with a couple of small changes

import { Base } from './insider-trusted.js';

export const Partner = (() => {
	const cls = Object.freeze(class Partner { // ** Unrelated to Base **
		static #insiderBaton;
		#baseInstance; // Reference instance (instead of `this`)
		#insider;

		constructor (baseInstance) {
			// Accept base instance parameter instead of using `this`
			this.#baseInstance = baseInstance;
			Base._getInsider(cls, baseInstance, () => this.#insider = cls.#insiderBaton);
			// Insider properties (this.#insider.prop) now available here
		}

		// Standard handoff-pattern class-method
		static _passInsider (insider, receiver) {
			this.#insiderBaton = insider;
			receiver();
			this.#insiderBaton = null;
		}
	});
	Object.freeze(cls.prototype);
	return cls;
})();
