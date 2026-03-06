/**
 * Tests for Base class insider pattern
 */

import { assertEquals, assertExists, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts';
let trustedOverride = null;

// Create a test-specific Base class with instrumentation
const TestBase = (() => {
	let isTrustedCalled = false;
	let trustedList = null;

	const isTrusted = (cls) => {
		if (trustedOverride) {
			trustedList = trustedOverride;
			trustedOverride = null;
		}
		isTrustedCalled = true;
		trustedList ||= [TestSub];
		return trustedList.includes(cls);
	};

	const cls = Object.freeze(class TestBase {
		static #insiderBaton = null;
		#insider = { testProp: 'initialized' };

		static _getInsider(reqCls, instance, receiver) {
			if (!isTrusted(reqCls)) throw new Error('Untrusted request');
			const passProps = Object.getOwnPropertyDescriptor(reqCls, '_passInsider');
			if (typeof passProps.value !== 'function' || passProps.writable !== false || passProps.configurable !== false) {
				throw new Error('Unsafe handoff');
			}
			reqCls._passInsider(instance.#insider, receiver);
		}

		// Instrumentation methods
		static wasIsTrustedCalled() {
			return isTrustedCalled;
		}

		static resetInstrumentation() {
			isTrustedCalled = false;
		}

		static resetTrusted () {
			trustedList = null;
		}
	});
	Object.freeze(cls.prototype);
	return cls;
})();

// Create a trusted test subclass
const TestSub = (() => {
	const cls = Object.freeze(class TestSub extends TestBase {
		static #insiderBaton = null;
		#insider;

		constructor() {
			super();
			TestBase._getInsider(cls, this, () => this.#insider = cls.#insiderBaton);
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

// Create an untrusted test class
const UntrustedClass = (() => {
	const cls = Object.freeze(class UntrustedClass {
		static _passInsider() {}
	});
	Object.freeze(cls.prototype);
	return cls;
})();

Deno.test('Base class - should create an instance successfully', () => {
	const instance = new TestBase();
	assertExists(instance);
	assertEquals(instance instanceof TestBase, true);
});

Deno.test('Base class - should have _getInsider static method', () => {
	assertEquals(typeof TestBase._getInsider, 'function');
});

Deno.test('Base class - should not expose #insider directly', () => {
	const instance = new TestBase();
	assertEquals(instance.insider, undefined);
	assertEquals(instance['#insider'], undefined);
});

Deno.test('Base class - should not expose #trusted directly', () => {
	assertEquals(TestBase.trusted, undefined);
	assertEquals(TestBase['#trusted'], undefined);
});

Deno.test('Base class - should not expose #insiderBaton directly', () => {
	assertEquals(TestBase.insiderBaton, undefined);
	assertEquals(TestBase['#insiderBaton'], undefined);
});

Deno.test('Base class - _getInsider should throw on untrusted request', () => {
	const instance = new TestBase();
	
	assertThrows(
		() => TestBase._getInsider(UntrustedClass, instance, () => {}),
		Error,
		'Untrusted request'
	);
});

Deno.test('Base class - _getInsider should throw if handoff method is not frozen', () => {
	// Create a class with non-frozen _passInsider method
	class UnsafeClass {
		static _passInsider() {}
	}
	
	trustedOverride = [UnsafeClass];
	TestBase.resetTrusted();
	const instance = new TestBase();
	
	// This should throw because _passInsider is writable
	assertThrows(
		() => TestBase._getInsider(UnsafeClass, instance, () => {}),
		Error,
		'Unsafe handoff'
	);
	TestBase.resetTrusted();
});

Deno.test('Base class - _getInsider should throw if handoff method is configurable', () => {
	// Create a class with configurable _passInsider method
	const cls = class ConfigurableClass {};
	Object.defineProperty(cls, '_passInsider', {
		value: function() {},
		writable: false,
		configurable: true // This should fail
	});
	
	trustedOverride = [cls];
	TestBase.resetTrusted();
	const instance = new TestBase();
	
	assertThrows(
		() => TestBase._getInsider(cls, instance, () => {}),
		Error,
		'Unsafe handoff'
	);
	TestBase.resetTrusted();
});

Deno.test('Base class - _getInsider should throw if handoff is not a function', () => {
	// Create a class with non-function _passInsider
	const cls = Object.freeze(class NonFunctionClass {
		static _passInsider = 'not a function';
	});
	
	trustedOverride = [cls];
	TestBase.resetTrusted();
	const instance = new TestBase();
	
	assertThrows(
		() => TestBase._getInsider(cls, instance, () => {}),
		Error,
		'Unsafe handoff'
	);
	TestBase.resetTrusted();
});

Deno.test('Base class - should be frozen', () => {
	assertEquals(Object.isFrozen(TestBase), true);
	assertEquals(Object.isFrozen(TestBase.prototype), true);
});

Deno.test('Base class - should successfully pass insider to trusted subclass', () => {
	const sub = new TestSub();
	const insider = sub.getInsider();
	
	assertExists(insider);
	assertEquals(typeof insider, 'object');
	assertEquals(insider.testProp, 'initialized');
});

Deno.test('Base class - multiple instances should each have their own insider', () => {
	const sub1 = new TestSub();
	const sub2 = new TestSub();
	
	const insider1 = sub1.getInsider();
	const insider2 = sub2.getInsider();
	
	// Each instance should have its own insider object
	assertEquals(insider1 !== insider2, true);
	
	// But both should have the initialized property
	assertEquals(insider1.testProp, 'initialized');
	assertEquals(insider2.testProp, 'initialized');
	
	// Modifying one shouldn't affect the other
	insider1.modified = true;
	assertEquals(insider2.modified, undefined);
});

Deno.test('Base class - insider should have thys reference to original instance', () => {
	// Create a test base with thys reference
	const TestBaseWithThys = (() => {
		const cls = Object.freeze(class TestBaseWithThys {
			static #insiderBaton = null;
			static #protoInsider = Object.freeze({
				testMethod() {
					return this.thys;
				}
			});
			#insider;

			constructor() {
				const insider = this.#insider = Object.create(cls.#protoInsider);
				insider.thys = this;
			}

			static _getInsider(reqCls, instance, receiver) {
				reqCls._passInsider(instance.#insider, receiver);
			}

			getInsider() {
				return this.#insider;
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	const instance = new TestBaseWithThys();
	const insider = instance.getInsider();
	
	// thys should reference the original instance
	assertEquals(insider.thys, instance);
	
	// Insider method should be able to access the instance via thys
	assertEquals(insider.testMethod(), instance);
});

Deno.test('Base class - insider methods should validate caller', () => {
	// Create a test base with security validation
	const TestBaseWithValidation = (() => {
		const cls = Object.freeze(class TestBaseWithValidation {
			static #insiderBaton = null;
			static #protoInsider = Object.freeze({
				secureMethod() {
					if (this !== this.thys.#insider) throw new Error('Unauthorized call');
					return 'authorized';
				}
			});
			#insider;

			constructor() {
				const insider = this.#insider = Object.create(cls.#protoInsider);
				insider.thys = this;
			}

			callSecureMethod() {
				return this.#insider.secureMethod();
			}

			getInsider() {
				return this.#insider;
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	const instance = new TestBaseWithValidation();
	
	// Calling through the instance should work
	assertEquals(instance.callSecureMethod(), 'authorized');
	
	// Direct call on insider should also work
	const insider = instance.getInsider();
	assertEquals(insider.secureMethod(), 'authorized');
});

Deno.test('Base class - insider methods should be shared via prototype', () => {
	// Create a test base with prototype methods
	const TestBaseWithProto = (() => {
		const cls = Object.freeze(class TestBaseWithProto {
			static #protoInsider = Object.freeze({
				sharedMethod() {
					return 'shared';
				}
			});
			#insider;

			constructor() {
				this.#insider = Object.create(cls.#protoInsider);
			}

			getInsider() {
				return this.#insider;
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	const instance1 = new TestBaseWithProto();
	const instance2 = new TestBaseWithProto();
	
	const insider1 = instance1.getInsider();
	const insider2 = instance2.getInsider();
	
	// Methods should be the same function (shared via prototype)
	assertEquals(insider1.sharedMethod, insider2.sharedMethod);
	
	// But insiders should be different objects
	assertEquals(insider1 !== insider2, true);
});
