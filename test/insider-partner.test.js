/**
 * Tests for Partner class insider pattern
 * Partner is a "partner-class" pattern that shares #insider state with Base
 * but is NOT a subclass of Base (unlike Sub)
 */

import { assertEquals, assertExists, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { Base, Partner } from '../insider-trusted.js';

// Create instrumented TestBase for testing with reconfigurable trust list
let testTrustedClasses = null;

const TestBase = (() => {
	const isTrusted = (cls) => {
		const trusted = testTrustedClasses || [TestPartner];
		return trusted.includes(cls);
	};
	const cls = Object.freeze(class TestBase {
		static #insiderBaton = null;
		#insider = { testProp: 'test-value', count: 42 };

		constructor(customInsider) {
			if (customInsider) { // For testing
				this.#insider = customInsider;
			}
		}

		static _getInsider(reqCls, instance, receiver) {
			if (!isTrusted(reqCls)) throw new Error('Untrusted request');
			const passProps = Object.getOwnPropertyDescriptor(reqCls, '_passInsider');
			if (typeof passProps.value !== 'function' || passProps.writable !== false || passProps.configurable !== false) {
				throw new Error('Unsafe handoff');
			}
			reqCls._passInsider(instance.#insider, receiver);
		}

		getInsider() {
			return this.#insider;
		}
	});
	Object.freeze(cls.prototype);
	return cls;
})();

// Create instrumented TestPartner for testing
const TestPartner = (() => {
	const cls = Object.freeze(class TestPartner {
		static #insiderBaton;
		#baseInstance;
		#insider;

		constructor(baseInstance) {
			this.#baseInstance = baseInstance;
			TestBase._getInsider(cls, baseInstance, () => this.#insider = cls.#insiderBaton);
		}

		static _passInsider(insider, receiver) {
			this.#insiderBaton = insider;
			receiver();
			this.#insiderBaton = null;
		}

		getInsider() {
			return this.#insider;
		}

		#getInsiderFor(other) {
			if (other instanceof cls) return other.#insider;
			if (other instanceof TestBase) {
				let insider;
				TestBase._getInsider(cls, other, () => insider = cls.#insiderBaton);
				return insider;
			}
		}

		// Expose for testing
		getInsiderFor(other) {
			return this.#getInsiderFor(other);
		}
	});
	Object.freeze(cls.prototype);
	return cls;
})();

Deno.test('Partner class - should create an instance with Base instance parameter', () => {
	const base = new Base();
	const partner = new Partner(base);
	assertExists(partner);
	assertEquals(partner instanceof Partner, true);
});

Deno.test('Partner class - should NOT be a subclass of Base', () => {
	const base = new Base();
	const partner = new Partner(base);
	assertEquals(partner instanceof Base, false);
});

Deno.test('Partner class - should be frozen', () => {
	assertEquals(Object.isFrozen(Partner), true);
	assertEquals(Object.isFrozen(Partner.prototype), true);
});

Deno.test('Partner class - should have _passInsider static method', () => {
	assertEquals(typeof Partner._passInsider, 'function');
});

Deno.test('Partner class - _passInsider should be frozen', () => {
	const passProps = Object.getOwnPropertyDescriptor(Partner, '_passInsider');
	assertEquals(typeof passProps.value, 'function');
	assertEquals(passProps.writable, false);
	assertEquals(passProps.configurable, false);
});

Deno.test('Partner class - should not expose #insider directly', () => {
	const base = new Base();
	const partner = new Partner(base);
	assertEquals(partner.insider, undefined);
	assertEquals(partner['#insider'], undefined);
});

Deno.test('Partner class - should not expose #baseInstance directly', () => {
	const base = new Base();
	const partner = new Partner(base);
	assertEquals(partner.baseInstance, undefined);
	assertEquals(partner['#baseInstance'], undefined);
});

Deno.test('Partner class - should not expose #insiderBaton directly', () => {
	assertEquals(Partner.insiderBaton, undefined);
	assertEquals(Partner['#insiderBaton'], undefined);
});

Deno.test('Partner class - should successfully receive insider from Base', () => {
	// Use instrumented classes to verify insider is actually received
	const testBase = new TestBase();
	const testPartner = new TestPartner(testBase);
	
	const baseInsider = testBase.getInsider();
	const partnerInsider = testPartner.getInsider();
	
	// Partner should have received the same insider object
	assertEquals(partnerInsider, baseInsider);
	assertEquals(partnerInsider.testProp, 'test-value');
	assertEquals(partnerInsider.count, 42);
});

Deno.test('Partner class - multiple Partner instances with same Base', () => {
	// Multiple partners with same base should share the same #insider
	const testBase = new TestBase();
	const testPartner1 = new TestPartner(testBase);
	const testPartner2 = new TestPartner(testBase);
	
	const baseInsider = testBase.getInsider();
	const partner1Insider = testPartner1.getInsider();
	const partner2Insider = testPartner2.getInsider();
	
	// All should reference the same insider object
	assertEquals(partner1Insider, baseInsider);
	assertEquals(partner2Insider, baseInsider);
	assertEquals(partner1Insider, partner2Insider);
	
	// But the Partner instances themselves should be different
	assertEquals(testPartner1 !== testPartner2, true);
});

Deno.test('Partner class - multiple Partner instances with different Base instances', () => {
	// Each partner should get the correct #insider from its respective base
	const testBase1 = new TestBase();
	const testBase2 = new TestBase();
	const testPartner1 = new TestPartner(testBase1);
	const testPartner2 = new TestPartner(testBase2);
	
	const base1Insider = testBase1.getInsider();
	const base2Insider = testBase2.getInsider();
	const partner1Insider = testPartner1.getInsider();
	const partner2Insider = testPartner2.getInsider();
	
	// Each partner should have its base's insider
	assertEquals(partner1Insider, base1Insider);
	assertEquals(partner2Insider, base2Insider);
	
	// The insiders should be different objects
	assertEquals(partner1Insider !== partner2Insider, true);
	
	// But both should have the same structure
	assertEquals(partner1Insider.testProp, 'test-value');
	assertEquals(partner2Insider.testProp, 'test-value');
});

Deno.test('Partner class - should work with Base instances that have modified insider', () => {
	const testBase = new TestBase();
	const insider = testBase.getInsider();
	const testPartner = new TestPartner(testBase);
	const partnerInsider = testPartner.getInsider();
	insider.modified = true;
	insider.newProp = 'added';
	
	// Partner should sharing the same, modified insider (not a copy)
	
	assertEquals(partnerInsider, insider);
	assertEquals(partnerInsider.modified, true);
	assertEquals(partnerInsider.newProp, 'added');
});

Deno.test('Partner class - constructor should throw if Base instance is not provided', () => {
	assertThrows(
		() => new Partner(),
		TypeError
	);
});

Deno.test('Partner class - constructor should throw if non-Base instance is provided', () => {
	assertThrows(
		() => new Partner({}),
		Error
	);
});

Deno.test('Partner class - constructor should throw if null is provided', () => {
	assertThrows(
		() => new Partner(null),
		TypeError
	);
});

Deno.test('Partner class - _passInsider should handle insider handoff correctly', () => {
	// Create a test to verify the handoff mechanism works
	let receivedInsider = null;
	const testInsider = { test: 'value' };
	
	// Call _passInsider and capture the insider in the receiver
	Partner._passInsider(testInsider, () => {
		// During this callback, the baton should be set
		// We can't access it directly, but we can verify the callback runs
		receivedInsider = 'callback-executed';
	});
	
	assertEquals(receivedInsider, 'callback-executed');
});

Deno.test('Partner class - should be trusted by Base', () => {
	// This is verified by successful construction
	// If Partner wasn't trusted, Base._getInsider would throw
	const base = new Base();
	const partner = new Partner(base);
	assertExists(partner);
});

Deno.test('Partner class - should handle multiple sequential constructions', () => {
	const base = new Base();
	
	// Create multiple partners sequentially
	const partner1 = new Partner(base);
	const partner2 = new Partner(base);
	const partner3 = new Partner(base);
	
	assertExists(partner1);
	assertExists(partner2);
	assertExists(partner3);
	
	// All should be valid Partner instances
	assertEquals(partner1 instanceof Partner, true);
	assertEquals(partner2 instanceof Partner, true);
	assertEquals(partner3 instanceof Partner, true);
});

Deno.test('Partner class - should work with Base subclass instances', async () => {
	// Partner should work with Sub instances (which extend Base)
	const { Sub } = await import('../insider-trusted.js');
	const sub = new Sub();
	const partner = new Partner(sub);
	
	assertExists(partner);
	assertEquals(partner instanceof Partner, true);
});

Deno.test('Partner class - prototype should be frozen', () => {
	assertEquals(Object.isFrozen(Partner.prototype), true);
});

Deno.test('Partner class - should not allow modification of class', () => {
	// Attempt to add a property to the frozen class
	assertThrows(() => {
		Partner.newProperty = 'test';
	});
});

Deno.test('Partner class - should not allow modification of prototype', () => {
	// Attempt to add a method to the frozen prototype
	assertThrows(() => {
		Partner.prototype.newMethod = function() {};
	});
});

Deno.test('Partner class - _passInsider should clear baton after receiver executes', () => {
	// This test verifies that the baton is properly cleared
	// We can't access the baton directly, but we can verify behavior
	const testInsider = { test: 'value' };
	let callbackExecuted = false;
	
	Partner._passInsider(testInsider, () => {
		callbackExecuted = true;
	});
	
	assertEquals(callbackExecuted, true);
	
	// If we call it again, it should work (baton was cleared)
	callbackExecuted = false;
	Partner._passInsider(testInsider, () => {
		callbackExecuted = true;
	});
	
	assertEquals(callbackExecuted, true);
});

Deno.test('Partner class - should handle rapid instance creation', () => {
	const base = new Base();
	const partners = [];
	
	// Create many partners rapidly
	for (let i = 0; i < 10; i++) {
		partners.push(new Partner(base));
	}
	
	assertEquals(partners.length, 10);
	partners.forEach(partner => {
		assertExists(partner);
		assertEquals(partner instanceof Partner, true);
	});
});

Deno.test('Partner class - should maintain separate state per instance', () => {
	// Even though we can't directly access #insider, we can verify
	// that each Partner instance is independent
	const base1 = new Base();
	const base2 = new Base();
	const partner1 = new Partner(base1);
	const partner2 = new Partner(base2);
	
	// Each partner should be a distinct object
	assertEquals(partner1 !== partner2, true);
	
	// Verify they're both valid instances
	assertEquals(partner1 instanceof Partner, true);
	assertEquals(partner2 instanceof Partner, true);
});

Deno.test('Partner class - #getInsiderFor should access same-class Partner insider', () => {
	const testBase = new TestBase();
	const testPartner1 = new TestPartner(testBase);
	const testPartner2 = new TestPartner(testBase);
	
	// Partner1 should be able to access Partner2's insider
	const partner2Insider = testPartner1.getInsiderFor(testPartner2);
	const actualPartner2Insider = testPartner2.getInsider();
	
	assertEquals(partner2Insider, actualPartner2Insider);
	assertEquals(partner2Insider.testProp, 'test-value');
});

Deno.test('Partner class - #getInsiderFor should access cross-class Base insider', () => {
	const testBase1 = new TestBase();
	const testBase2 = new TestBase();
	const testPartner = new TestPartner(testBase1);
	
	// Partner should be able to access a different Base instance's insider
	const base2Insider = testPartner.getInsiderFor(testBase2);
	const actualBase2Insider = testBase2.getInsider();
	
	assertEquals(base2Insider, actualBase2Insider);
	assertEquals(base2Insider.testProp, 'test-value');
});

Deno.test('Partner class - #getInsiderFor with multiple Partner instances', () => {
	const testBase = new TestBase();
	const testPartner1 = new TestPartner(testBase);
	const testPartner2 = new TestPartner(testBase);
	const testPartner3 = new TestPartner(testBase);
	
	// All partners share the same base, so they all share the same insider
	const insider1 = testPartner1.getInsiderFor(testPartner2);
	const insider2 = testPartner2.getInsiderFor(testPartner3);
	const insider3 = testPartner3.getInsiderFor(testPartner1);
	
	assertEquals(insider1, insider2);
	assertEquals(insider2, insider3);
	assertEquals(insider1, testBase.getInsider());
});

Deno.test('Partner class - modifications through one partner visible to others', () => {
	const testBase = new TestBase();
	const testPartner1 = new TestPartner(testBase);
	const testPartner2 = new TestPartner(testBase);
	
	// Modify insider through partner1
	const insider1 = testPartner1.getInsider();
	insider1.sharedModification = 'visible';
	
	// Should be visible through partner2
	const insider2 = testPartner2.getInsider();
	assertEquals(insider2.sharedModification, 'visible');
	
	// And through the base
	const baseInsider = testBase.getInsider();
	assertEquals(baseInsider.sharedModification, 'visible');
});

Deno.test('Partner class - should handle Base instance with empty insider', () => {
	// Create a Base with minimal insider
	const minimalBase = new TestBase({});
	const testPartner = new TestPartner(minimalBase);
	
	assertExists(testPartner);
	const insider = testPartner.getInsider();
	assertEquals(typeof insider, 'object');
	assertEquals(Object.keys(insider).length, 0);
});

Deno.test('Partner class - should work with Base that has complex insider state', () => {
	const testBase = new TestBase();
	const insider = testBase.getInsider();
	
	// Add complex state
	insider.nested = { deep: { value: 'nested' } };
	insider.array = [1, 2, 3];
	insider.func = () => 'function';
	
	const testPartner = new TestPartner(testBase);
	const partnerInsider = testPartner.getInsider();
	
	// Partner should have access to all complex state
	assertEquals(partnerInsider.nested.deep.value, 'nested');
	assertEquals(partnerInsider.array.length, 3);
	assertEquals(typeof partnerInsider.func, 'function');
	assertEquals(partnerInsider.func(), 'function');
});

Deno.test('Partner class - gatedMethod should validate insider parameter', () => {
	// Create a partner with gated method
	const TestPartnerWithGate = (() => {
		const cls = Object.freeze(class TestPartnerWithGate {
			static #insiderBaton;
			#insider;

			constructor(baseInstance) {
				TestBase._getInsider(cls, baseInstance, () => this.#insider = cls.#insiderBaton);
			}

			static _passInsider(insider, receiver) {
				cls.#insiderBaton = insider;
				try { receiver(); }
				finally { cls.#insiderBaton = null; }
			}

			gatedMethod(insider) {
				if (insider !== this.#insider) throw new Error('Unauthorized');
				return 'authorized';
			}

			getInsider() {
				return this.#insider;
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	// Trust the new partner class
	testTrustedClasses = [TestPartner, TestPartnerWithGate];
	
	const testBase = new TestBase();
	const testPartner = new TestPartnerWithGate(testBase);
	const insider = testPartner.getInsider();
	
	// Calling with correct insider should work
	assertEquals(testPartner.gatedMethod(insider), 'authorized');
	
	// Calling with wrong insider should throw
	assertThrows(
		() => testPartner.gatedMethod({}),
		Error,
		'Unauthorized'
	);
	
	// Calling with null should throw
	assertThrows(
		() => testPartner.gatedMethod(null),
		Error,
		'Unauthorized'
	);
	
	// Reset trust list
	testTrustedClasses = null;
});

Deno.test('Partner class - gatedMethod allows trusted classes to call partner methods', () => {
	// Create a partner with gated method
	const TestPartnerWithGate = (() => {
		const cls = Object.freeze(class TestPartnerWithGate {
			static #insiderBaton;
			#insider;

			constructor(baseInstance) {
				TestBase._getInsider(cls, baseInstance, () => this.#insider = cls.#insiderBaton);
			}

			static _passInsider(insider, receiver) {
				cls.#insiderBaton = insider;
				try { receiver(); }
				finally { cls.#insiderBaton = null; }
			}

			gatedMethod(insider) {
				if (insider !== this.#insider) throw new Error('Unauthorized');
				return 'partner-result';
			}

			getInsider() {
				return this.#insider;
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	// Create a trusted class that can call the gated method
	const TestTrustedCaller = (() => {
		const cls = Object.freeze(class TestTrustedCaller {
			static #insiderBaton;
			#insider;

			constructor(baseInstance) {
				TestBase._getInsider(cls, baseInstance, () => this.#insider = cls.#insiderBaton);
			}

			static _passInsider(insider, receiver) {
				cls.#insiderBaton = insider;
				try { receiver(); }
				finally { cls.#insiderBaton = null; }
			}

			callPartnerMethod(partner) {
				// Can call gated method because we have the insider
				return partner.gatedMethod(this.#insider);
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	// Trust both classes
	testTrustedClasses = [TestPartner, TestPartnerWithGate, TestTrustedCaller];
	
	const testBase = new TestBase();
	const testPartner = new TestPartnerWithGate(testBase);
	const testCaller = new TestTrustedCaller(testBase);
	
	// Trusted caller should be able to call the gated method
	assertEquals(testCaller.callPartnerMethod(testPartner), 'partner-result');
	
	// Reset trust list
	testTrustedClasses = null;
});

Deno.test('Partner class - gatedMethod prevents untrusted classes from calling', () => {
	// Create a partner with gated method
	const TestPartnerWithGate = (() => {
		const cls = Object.freeze(class TestPartnerWithGate {
			static #insiderBaton;
			#insider;

			constructor(baseInstance) {
				TestBase._getInsider(cls, baseInstance, () => this.#insider = cls.#insiderBaton);
			}

			static _passInsider(insider, receiver) {
				cls.#insiderBaton = insider;
				try { receiver(); }
				finally { cls.#insiderBaton = null; }
			}

			gatedMethod(insider) {
				if (insider !== this.#insider) throw new Error('Unauthorized');
				return 'authorized';
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	// Trust the partner class
	testTrustedClasses = [TestPartner, TestPartnerWithGate];
	
	const testBase = new TestBase();
	const testPartner = new TestPartnerWithGate(testBase);
	
	// Untrusted code can't call the method without the insider
	assertThrows(
		() => testPartner.gatedMethod({}),
		Error,
		'Unauthorized'
	);
	
	// Even if they try to guess or create a fake insider
	const fakeInsider = { testProp: 'test-value', count: 42 };
	assertThrows(
		() => testPartner.gatedMethod(fakeInsider),
		Error,
		'Unauthorized'
	);
	
	// Reset trust list
	testTrustedClasses = null;
});

Deno.test('Partner class - actual Partner.gatedMethod should validate insider', () => {
	const base = new Base();
	const partner = new Partner(base);
	
	// We can't directly access the insider from outside, but we can test
	// that calling with wrong parameters throws
	assertThrows(
		() => partner.gatedMethod({}),
		Error,
		'Unauthorized'
	);
	
	assertThrows(
		() => partner.gatedMethod(null),
		Error,
		'Unauthorized'
	);
});
