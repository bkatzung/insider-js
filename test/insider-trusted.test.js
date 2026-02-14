/**
 * Tests for insider trust mechanism
 */

import { assertEquals, assertExists, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { Base, Sub, getTrusted } from '../insider-trusted.js';

Deno.test('Trust - getTrusted should return an array', () => {
	const trusted = getTrusted();
	assertExists(trusted);
	assertEquals(Array.isArray(trusted), true);
});

Deno.test('Trust - getTrusted should include Sub in trusted list', () => {
	const trusted = getTrusted();
	assertEquals(trusted.includes(Sub), true);
});

Deno.test('Trust - getTrusted should return frozen array', () => {
	const trusted = getTrusted();
	assertEquals(Object.isFrozen(trusted), true);
});

Deno.test('Trust - getTrusted should return same array on multiple calls', () => {
	const trusted1 = getTrusted();
	const trusted2 = getTrusted();
	assertEquals(trusted1 === trusted2, true);
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

Deno.test('Trust - trusted list should be immutable', () => {
	const trusted = getTrusted();
	const originalLength = trusted.length;
	
	// Try to modify the array
	assertThrows(() => {
		trusted.push(class FakeClass {});
	});
	
	// Length should remain unchanged
	assertEquals(trusted.length, originalLength);
});

Deno.test('Trust - Base._getInsider should be accessible', () => {
	assertEquals(typeof Base._getInsider, 'function');
});

Deno.test('Trust - Sub._passInsider should be accessible', () => {
	assertEquals(typeof Sub._passInsider, 'function');
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
	assertExists(getTrusted);
	
	// Verify they are the correct types
	assertEquals(typeof Base, 'function');
	assertEquals(typeof Sub, 'function');
	assertEquals(typeof getTrusted, 'function');
});
