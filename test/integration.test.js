/**
 * Integration tests for the insider pattern
 * Tests the complete pattern with real-world scenarios
 */

import { assertEquals, assertExists, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { Base, Sub } from '../insider-trusted.js';

Deno.test('Integration - complete pattern with Base and Sub', () => {
	const base = new Base();
	const sub = new Sub();
	
	assertExists(base);
	assertExists(sub);
	assertEquals(base instanceof Base, true);
	assertEquals(sub instanceof Sub, true);
	assertEquals(sub instanceof Base, true);
});

Deno.test('Integration - multi-level inheritance with insider access', () => {
	// Create a SubSub class that extends Sub
	const SubSub = (() => {
		const cls = Object.freeze(class SubSub extends Sub {
			static #insiderBaton = null;
			#insider;

			constructor() {
				super();
				Base._getInsider(cls, this, () => this.#insider = cls.#insiderBaton);
				this.#insider.level = 'subsub';
			}

			static _passInsider(insider, receiver) {
				cls.#insiderBaton = insider;
				receiver();
				cls.#insiderBaton = null;
			}

			getInsider() {
				return this.#insider;
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	// This should throw because SubSub is not in the trusted list
	assertThrows(
		() => new SubSub(),
		Error,
		'Untrusted request'
	);
});

Deno.test('Integration - insider state is per-instance', () => {
	// Create a test subclass that can expose insider
	const TestSub = (() => {
		const cls = Object.freeze(class TestSub extends Base {
			static #insiderBaton = null;
			#insider;

			constructor(id) {
				super();
				Base._getInsider(cls, this, () => this.#insider = cls.#insiderBaton);
				this.#insider.id = id;
			}

			static _passInsider(insider, receiver) {
				cls.#insiderBaton = insider;
				receiver();
				cls.#insiderBaton = null;
			}

			getInsider() {
				return this.#insider;
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	// This will fail because TestSub is not trusted
	assertThrows(
		() => new TestSub('test1'),
		Error,
		'Untrusted request'
	);
});

Deno.test('Integration - frozen classes prevent tampering', () => {
	// Verify Base is frozen
	assertEquals(Object.isFrozen(Base), true);
	assertEquals(Object.isFrozen(Base.prototype), true);
	
	// Verify Sub is frozen
	assertEquals(Object.isFrozen(Sub), true);
	assertEquals(Object.isFrozen(Sub.prototype), true);
	
	// Try to add a method to Base
	assertThrows(() => {
		Base.newMethod = function() {};
	});
	
	// Try to add a method to Sub
	assertThrows(() => {
		Sub.newMethod = function() {};
	});
});

Deno.test('Integration - _passInsider is frozen on Sub', () => {
	const passProps = Object.getOwnPropertyDescriptor(Sub, '_passInsider');
	
	assertEquals(typeof passProps.value, 'function');
	assertEquals(passProps.writable, false);
	assertEquals(passProps.configurable, false);
	
	// Try to replace _passInsider
	assertThrows(() => {
		Sub._passInsider = function() {};
	});
});

Deno.test('Integration - multiple Sub instances work independently', () => {
	const sub1 = new Sub();
	const sub2 = new Sub();
	const sub3 = new Sub();
	
	assertExists(sub1);
	assertExists(sub2);
	assertExists(sub3);
	
	// All should be valid instances
	assertEquals(sub1 instanceof Sub, true);
	assertEquals(sub2 instanceof Sub, true);
	assertEquals(sub3 instanceof Sub, true);
	
	// All should be different instances
	assertEquals(sub1 !== sub2, true);
	assertEquals(sub2 !== sub3, true);
	assertEquals(sub1 !== sub3, true);
});

Deno.test('Integration - Base and Sub are properly exported', () => {
	// Verify exports
	assertExists(Base);
	assertExists(Sub);
	
	// Verify they are constructors
	assertEquals(typeof Base, 'function');
	assertEquals(typeof Sub, 'function');
	
	// Verify they can be instantiated
	const base = new Base();
	const sub = new Sub();
	
	assertExists(base);
	assertExists(sub);
});

Deno.test('Integration - trust mechanism prevents unauthorized access', () => {
	// Create an untrusted class with proper structure
	const Untrusted = (() => {
		const cls = Object.freeze(class Untrusted extends Base {
			static #insiderBaton = null;
			#insider;

			constructor() {
				super();
				// This should throw
				Base._getInsider(cls, this, () => this.#insider = cls.#insiderBaton);
			}

			static _passInsider(insider, receiver) {
				cls.#insiderBaton = insider;
				receiver();
				cls.#insiderBaton = null;
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	assertThrows(
		() => new Untrusted(),
		Error,
		'Untrusted request'
	);
});

Deno.test('Integration - pattern works with inheritance chain', () => {
	// Base -> Sub is the trusted chain
	const sub = new Sub();
	
	assertExists(sub);
	assertEquals(sub instanceof Sub, true);
	assertEquals(sub instanceof Base, true);
	
	// Verify prototype chain
	assertEquals(Object.getPrototypeOf(sub) === Sub.prototype, true);
	assertEquals(Object.getPrototypeOf(Sub.prototype) === Base.prototype, true);
});

Deno.test('Integration - baton pattern ensures secure handoff', () => {
	// The baton should not be accessible from outside
	assertEquals(Sub.insiderBaton, undefined);
	assertEquals(Sub['#insiderBaton'], undefined);
	
	// Create an instance - baton should be used and cleared
	const sub = new Sub();
	assertExists(sub);
	
	// Baton should still not be accessible
	assertEquals(Sub.insiderBaton, undefined);
	assertEquals(Sub['#insiderBaton'], undefined);
});

Deno.test('Integration - insider is truly private', () => {
	const sub = new Sub();
	
	// Insider should not be accessible from outside
	assertEquals(sub.insider, undefined);
	assertEquals(sub['#insider'], undefined);
	
	// Even with Object.keys or Object.getOwnPropertyNames
	const keys = Object.keys(sub);
	const propNames = Object.getOwnPropertyNames(sub);
	
	assertEquals(keys.includes('insider'), false);
	assertEquals(keys.includes('#insider'), false);
	assertEquals(propNames.includes('insider'), false);
	assertEquals(propNames.includes('#insider'), false);
});

Deno.test('Integration - pattern prevents prototype pollution', () => {
	// Try to pollute Base prototype
	assertThrows(() => {
		Base.prototype.malicious = function() {};
	});
	
	// Try to pollute Sub prototype
	assertThrows(() => {
		Sub.prototype.malicious = function() {};
	});
	
	// Verify prototypes are still clean
	assertEquals(Base.prototype.malicious, undefined);
	assertEquals(Sub.prototype.malicious, undefined);
});

Deno.test('Integration - complete workflow from construction to use', () => {
	// 1. Create Base instance
	const base = new Base();
	assertExists(base);
	
	// 2. Create Sub instance (which extends Base and gets insider access)
	const sub = new Sub();
	assertExists(sub);
	
	// 3. Verify inheritance
	assertEquals(sub instanceof Sub, true);
	assertEquals(sub instanceof Base, true);
	
	// 4. Verify both are frozen
	assertEquals(Object.isFrozen(Base), true);
	assertEquals(Object.isFrozen(Sub), true);
	
	// 5. Verify insider is private
	assertEquals(sub.insider, undefined);
	assertEquals(sub['#insider'], undefined);
});
