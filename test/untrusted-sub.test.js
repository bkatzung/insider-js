/**
 * Tests for untrusted subclass rejection scenarios
 * Verifies that the insider pattern properly rejects unauthorized access attempts
 */

import { assertEquals, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { Base } from '../insider-trusted.js';
const $GET = Symbol.for('jsInsiderGet');
const $PASS = Symbol.for('jsInsiderPass');

Deno.test('Untrusted - class not in trusted list should be rejected', () => {
	const UntrustedSub = (() => {
		const cls = Object.freeze(class UntrustedSub extends Base {
			static #insiderBaton = null;
			#$;

			constructor() {
				super();
				Base[$GET](cls, this, () => this.#$ = cls.#insiderBaton);
			}

			static [$PASS](insider, receiver) {
				cls.#insiderBaton = insider;
				receiver();
				cls.#insiderBaton = null;
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	assertThrows(
		() => new UntrustedSub(),
		Error,
		'Untrusted request'
	);
});

Deno.test('Untrusted - class with non-frozen $PASS should be rejected', () => {
	// Create a class with writable $PASS
	class UnsafeSub extends Base {
		static #insiderBaton = null;
		#$;

		constructor() {
			super();
			Base[$GET](UnsafeSub, this, () => this.#$ = UnsafeSub.#insiderBaton);
		}

		static [$PASS](insider, receiver) {
			UnsafeSub.#insiderBaton = insider;
			receiver();
			UnsafeSub.#insiderBaton = null;
		}
	}

	// Even if we somehow got it in the trusted list, it should fail the safety check
	assertThrows(
		() => new UnsafeSub(),
		Error
	);
});

Deno.test('Untrusted - class with configurable $PASS should be rejected', () => {
	const UnsafeSub = class extends Base {
		static #insiderBaton = null;
		#$;

		constructor() {
			super();
			Base[$GET](UnsafeSub, this, () => this.#$ = UnsafeSub.#insiderBaton);
		}

		static #passInsider(insider, receiver) {
			UnsafeSub.#insiderBaton = insider;
			receiver();
			UnsafeSub.#insiderBaton = null;
		}

		static get [$PASS] () { return this.#passInsider; }
	};

	assertThrows(
		() => new UnsafeSub(),
		Error
	);
});

Deno.test('Untrusted - class with non-function $PASS should be rejected', () => {
	const BadSub = (() => {
		const cls = Object.freeze(class BadSub extends Base {
			static [$PASS] = 'not a function';
			static #insiderBaton = null;
			#$;

			constructor() {
				super();
				Base[$GET](cls, this, () => this.#$ = cls.#insiderBaton);
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	assertThrows(
		() => new BadSub(),
		Error
	);
});

Deno.test('Untrusted - class without $PASS should be rejected', () => {
	const NoPassSub = (() => {
		const cls = Object.freeze(class NoPassSub extends Base {
			static #insiderBaton = null;
			#$;

			constructor() {
				super();
				Base[$GET](cls, this, () => this.#$ = cls.#insiderBaton);
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	assertThrows(
		() => new NoPassSub(),
		Error
	);
});

Deno.test('Untrusted - attempting to call $GET with null receiver', () => {
	const instance = new Base();
	
	const TestSub = (() => {
		const cls = Object.freeze(class TestSub extends Base {
			static [$PASS]() {}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	// Should throw because TestSub is not trusted
	assertThrows(
		() => Base[$GET](TestSub, instance, null),
		Error
	);
});

Deno.test('Untrusted - attempting to access insider from outside class hierarchy', () => {
	const instance = new Base();
	
	// Create a completely unrelated class
	class UnrelatedClass {
		static [$PASS]() {}
	}

	assertThrows(
		() => Base[$GET](UnrelatedClass, instance, () => {}),
		Error,
		'Untrusted request'
	);
});

Deno.test('Untrusted - isTrusted should reject untrusted classes', async () => {
	// isTrusted should return false for classes not in the trusted list
	const { isTrusted } = await import('../insider-trusted.js');
	
	class FakeClass {}
	class AnotherFakeClass {}
	
	// These should not be trusted
	assertEquals(isTrusted(FakeClass), false);
	assertEquals(isTrusted(AnotherFakeClass), false);
	assertEquals(isTrusted(class Anonymous {}), false);
});

Deno.test('Untrusted - subclass of trusted class is not automatically trusted', async () => {
	const { Sub } = await import('../insider-trusted.js');
	
	// Create a subclass of the trusted Sub
	const SubSub = (() => {
		const cls = Object.freeze(class SubSub extends Sub {
			static #insiderBaton = null;
			#$;

			constructor() {
				super();
				// This should throw because SubSub is not explicitly trusted
				Base[$GET](cls, this, () => this.#$ = cls.#insiderBaton);
			}

			static [$PASS](insider, receiver) {
				cls.#insiderBaton = insider;
				receiver();
				cls.#insiderBaton = null;
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	assertThrows(
		() => new SubSub(),
		Error,
		'Untrusted request'
	);
});

Deno.test('Untrusted - cannot access Base private fields directly', () => {
	const instance = new Base();
	
	// Private fields should not be accessible
	assertEquals(instance['#$'], undefined);
	assertEquals(instance['#insiderBaton'], undefined);
	
	// Static private fields should not be accessible
	assertEquals(Base['#insiderBaton'], undefined);
});

Deno.test('Untrusted - cannot modify Base class or prototype', () => {
	// Base should be frozen
	assertEquals(Object.isFrozen(Base), true);
	assertEquals(Object.isFrozen(Base.prototype), true);
	
	// Try to add properties
	assertThrows(() => {
		Base.newProp = 'value';
	});
	
	assertThrows(() => {
		Base.prototype.newMethod = function() {};
	});
	
	// Try to modify existing properties
	assertThrows(() => {
		Base[$GET] = function() {};
	});
});

Deno.test('Untrusted - cannot intercept baton during handoff', () => {
	// The baton is class-private and should not be accessible during handoff
	let interceptedBaton = null;
	
	const MaliciousSub = (() => {
		const cls = Object.freeze(class MaliciousSub extends Base {
			static #insiderBaton = null;
			#$;

			constructor() {
				super();
				// Try to intercept the baton
				Base[$GET](cls, this, () => {
					interceptedBaton = cls.#insiderBaton;
					this.#$ = cls.#insiderBaton;
				});
				// Expected to throw because MaliciousSub is not trusted
			}

			static [$PASS](insider, receiver) {
				cls.#insiderBaton = insider;
				receiver();
				cls.#insiderBaton = null;
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	assertThrows(
		() => new MaliciousSub(),
		Error,
		'Untrusted request'
	);
	
	// Baton should not have been intercepted
	assertEquals(interceptedBaton, null);
});

Deno.test('Untrusted - cannot bypass trust check with prototype manipulation', async () => {
	const { Sub } = await import('../insider-trusted.js');
	
	// Try to create a class that inherits from Sub's prototype
	const SneakySub = (() => {
		const cls = function() {
			Base.call(this);
		};
		cls.prototype = Object.create(Sub.prototype);
		
		return cls;
	})();

	// This should fail because SneakySub is not properly structured
	// and not in the trusted list
	assertThrows(
		() => new SneakySub(),
		Error
	);
});

Deno.test('Untrusted - cannot access insider through reflection', async () => {
	const { Sub } = await import('../insider-trusted.js');
	const instance = new Sub();
	
	// Try various reflection techniques
	const symbols = Object.getOwnPropertySymbols(instance);
	const keys = Object.keys(instance);
	const propNames = Object.getOwnPropertyNames(instance);
	const descriptors = Object.getOwnPropertyDescriptors(instance);
	
	// None should reveal the private #$ field
	assertEquals(symbols.length, 0);
	assertEquals(keys.includes('$'), false);
	assertEquals(keys.includes('#$'), false);
	assertEquals(propNames.includes('$'), false);
	assertEquals(propNames.includes('#$'), false);
	assertEquals(descriptors.insider, undefined);
	assertEquals(descriptors['#$'], undefined);
});
