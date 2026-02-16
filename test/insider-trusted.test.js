/**
 * Tests for insider trust mechanism
 */

import { assertEquals, assertExists, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { Base, Sub, Partner, isTrusted } from '../insider-trusted.js';

Deno.test('Trust - isTrusted should be a function', () => {
	assertExists(isTrusted);
	assertEquals(typeof isTrusted, 'function');
});

Deno.test('Trust - isTrusted should return true for Sub', () => {
	assertEquals(isTrusted(Sub), true);
});

Deno.test('Trust - isTrusted should return true for Partner', () => {
	assertEquals(isTrusted(Partner), true);
});

Deno.test('Trust - isTrusted should return false for untrusted class', () => {
	class UntrustedClass {}
	assertEquals(isTrusted(UntrustedClass), false);
});

Deno.test('Trust - Base should export correctly', () => {
	assertExists(Base);
	assertEquals(typeof Base, 'function');
});

Deno.test('Trust - Sub should export correctly', () => {
	assertExists(Sub);
	assertEquals(typeof Sub, 'function');
});

Deno.test('Trust - Sub should extend Base', () => {
	const instance = new Sub();
	assertEquals(instance instanceof Sub, true);
	assertEquals(instance instanceof Base, true);
});

Deno.test('Trust - Base should trust Sub for insider access', () => {
	// This test verifies that Sub can successfully construct
	// which requires Base to trust it
	const instance = new Sub();
	assertExists(instance);
	assertEquals(instance instanceof Sub, true);
});

Deno.test('Trust - Base should reject untrusted classes', () => {
	// Create an untrusted class that tries to access insider
	const UntrustedSub = (() => {
		const cls = Object.freeze(class UntrustedSub extends Base {
			static #insiderBaton = null;
			#insider;

			constructor() {
				super();
				// This should throw because UntrustedSub is not in the trusted list
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
		() => new UntrustedSub(),
		Error,
		'Untrusted request'
	);
});

Deno.test('Trust - Base._getInsider should be accessible', () => {
	assertEquals(typeof Base._getInsider, 'function');
});

Deno.test('Trust - Sub._passInsider should be accessible', () => {
	assertEquals(typeof Sub._passInsider, 'function');
});

Deno.test('Trust - Partner._passInsider should be accessible', () => {
	assertEquals(typeof Partner._passInsider, 'function');
});

Deno.test('Trust - multiple Sub instances should all be trusted', () => {
	// All instances should construct successfully
	const instance1 = new Sub();
	const instance2 = new Sub();
	const instance3 = new Sub();
	
	assertExists(instance1);
	assertExists(instance2);
	assertExists(instance3);
	
	assertEquals(instance1 instanceof Sub, true);
	assertEquals(instance2 instanceof Sub, true);
	assertEquals(instance3 instanceof Sub, true);
});

Deno.test('Trust - barrel export should provide all necessary components', () => {
	// Verify all exports are present
	assertExists(Base);
	assertExists(Sub);
	assertExists(Partner);
	assertExists(isTrusted);
	
	// Verify they are the correct types
	assertEquals(typeof Base, 'function');
	assertEquals(typeof Sub, 'function');
	assertEquals(typeof Partner, 'function');
	assertEquals(typeof isTrusted, 'function');
});
