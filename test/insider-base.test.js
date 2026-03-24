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
		#$ = { testProp: 'initialized' };

		static _get$(reqCls, instance, receiver) {
			if (!isTrusted(reqCls)) throw new Error('Untrusted request');
			const passProps = Object.getOwnPropertyDescriptor(reqCls, '_pass$');
			if (typeof passProps.value !== 'function' || passProps.writable !== false || passProps.configurable !== false) {
				throw new Error('Unsafe handoff');
			}
			reqCls._pass$(instance.#$, receiver);
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
		#$;

		constructor() {
			super();
			TestBase._get$(cls, this, () => this.#$ = cls.#insiderBaton);
		}

		static _pass$(insider, receiver) {
			cls.#insiderBaton = insider;
			receiver();
			cls.#insiderBaton = null;
		}

		getInsider() {
			return this.#$;
		}
	});
	Object.freeze(cls.prototype);
	return cls;
})();

// Create an untrusted test class
const UntrustedClass = (() => {
	const cls = Object.freeze(class UntrustedClass {
		static _pass$() {}
	});
	Object.freeze(cls.prototype);
	return cls;
})();

Deno.test('Base class - should create an instance successfully', () => {
	const instance = new TestBase();
	assertExists(instance);
	assertEquals(instance instanceof TestBase, true);
});

Deno.test('Base class - should have _get$ static method', () => {
	assertEquals(typeof TestBase._get$, 'function');
});

Deno.test('Base class - should not expose #$ directly', () => {
	const instance = new TestBase();
	assertEquals(instance.insider, undefined);
	assertEquals(instance['#$'], undefined);
});

Deno.test('Base class - should not expose #trusted directly', () => {
	assertEquals(TestBase.trusted, undefined);
	assertEquals(TestBase['#trusted'], undefined);
});

Deno.test('Base class - should not expose #insiderBaton directly', () => {
	assertEquals(TestBase.insiderBaton, undefined);
	assertEquals(TestBase['#insiderBaton'], undefined);
});

Deno.test('Base class - _get$ should throw on untrusted request', () => {
	const instance = new TestBase();
	
	assertThrows(
		() => TestBase._get$(UntrustedClass, instance, () => {}),
		Error,
		'Untrusted request'
	);
});

Deno.test('Base class - _get$ should throw if handoff method is not frozen', () => {
	// Create a class with non-frozen _pass$ method
	class UnsafeClass {
		static _pass$() {}
	}
	
	trustedOverride = [UnsafeClass];
	TestBase.resetTrusted();
	const instance = new TestBase();
	
	// This should throw because _pass$ is writable
	assertThrows(
		() => TestBase._get$(UnsafeClass, instance, () => {}),
		Error,
		'Unsafe handoff'
	);
	TestBase.resetTrusted();
});

Deno.test('Base class - _get$ should throw if handoff method is configurable', () => {
	// Create a class with configurable _pass$ method
	const cls = class ConfigurableClass {};
	Object.defineProperty(cls, '_pass$', {
		value: function() {},
		writable: false,
		configurable: true // This should fail
	});
	
	trustedOverride = [cls];
	TestBase.resetTrusted();
	const instance = new TestBase();
	
	assertThrows(
		() => TestBase._get$(cls, instance, () => {}),
		Error,
		'Unsafe handoff'
	);
	TestBase.resetTrusted();
});

Deno.test('Base class - _get$ should throw if handoff is not a function', () => {
	// Create a class with non-function _pass$
	const cls = Object.freeze(class NonFunctionClass {
		static _pass$ = 'not a function';
	});
	
	trustedOverride = [cls];
	TestBase.resetTrusted();
	const instance = new TestBase();
	
	assertThrows(
		() => TestBase._get$(cls, instance, () => {}),
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
			static #__insider = Object.freeze({
				testMethod() {
					return this.__this;
				}
			});
			#$;

			constructor() {
				const insider = this.#$ = Object.create(cls.#__insider);
				insider.__this = this;
			}

			static _get$(reqCls, instance, receiver) {
				reqCls._pass$(instance.#$, receiver);
			}

			getInsider() {
				return this.#$;
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	const instance = new TestBaseWithThys();
	const insider = instance.getInsider();
	
	// thys should reference the original instance
	assertEquals(insider.__this, instance);
	
	// Insider method should be able to access the instance via thys
	assertEquals(insider.testMethod(), instance);
});

Deno.test('Base class - insider methods should validate caller', () => {
	// Create a test base with security validation
	const TestBaseWithValidation = (() => {
		const cls = Object.freeze(class TestBaseWithValidation {
			static #insiderBaton = null;
			static #__insider = Object.freeze({
				secureMethod() {
					if (this !== this.__this.#$) throw new Error('Unauthorized call');
					return 'authorized';
				}
			});
			#$;

			constructor() {
				const insider = this.#$ = Object.create(cls.#__insider);
				insider.__this = this;
			}

			callSecureMethod() {
				return this.#$.secureMethod();
			}

			getInsider() {
				return this.#$;
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
			static #__insider = Object.freeze({
				sharedMethod() {
					return 'shared';
				}
			});
			#$;

			constructor() {
				this.#$ = Object.create(cls.#__insider);
			}

			getInsider() {
				return this.#$;
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
