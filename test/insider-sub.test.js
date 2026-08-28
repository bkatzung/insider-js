/**
 * Tests for Sub class insider pattern
 */

import { assert, assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { Base, Sub } from '../insider-trusted.js';
const $GET = Symbol.for('jsInsiderGet');
const $PASS = Symbol.for('jsInsiderPass');

// Create a test Base without trust checks for testing sub-class behavior
const TestBase = (() => {
	const cls = Object.freeze(class TestBase {
		static #insiderBaton = null;
		#$ = { initialized: true };

		constructor() {
			// No trust checks - just for testing sub-class pattern
		}

		// Simplified $GET without trust checks
		static [$GET](reqCls, instance, receiver) {
			reqCls[$PASS](instance.#$, receiver);
		}
	});
	Object.freeze(cls.prototype);
	return cls;
})();

Deno.test('Sub class - should create an instance successfully', () => {
	const instance = new Sub();
	assertExists(instance);
	assertEquals(instance instanceof Sub, true);
	assertEquals(instance instanceof Base, true);
});

Deno.test('Sub class - should have $PASS static method', () => {
	assertEquals(typeof Sub[$PASS], 'function');
});

Deno.test('Sub class - $PASS should be frozen', () => {
	const passProps = Object.getOwnPropertyDescriptor(Sub, $PASS);
	assertEquals(typeof passProps.value, 'function');
	assertEquals(passProps.writable, false);
	assertEquals(passProps.configurable, false);
});

Deno.test('Sub class - should not expose #$ directly', () => {
	const instance = new Sub();
	assertEquals(instance.insider, undefined);
	assertEquals(instance['#$'], undefined);
});

Deno.test('Sub class - should not expose #insiderBaton directly', () => {
	assertEquals(Sub.insiderBaton, undefined);
	assertEquals(Sub['#insiderBaton'], undefined);
});

Deno.test('Sub class - should be frozen', () => {
	assertEquals(Object.isFrozen(Sub), true);
	assertEquals(Object.isFrozen(Sub.prototype), true);
});

Deno.test('Sub class - should receive insider from Base', () => {
	const TestSub = (() => {
		const cls = Object.freeze(class TestSub extends TestBase {
			static #insiderBaton = null;
			#$;

			constructor() {
				super();
				TestBase[$GET](cls, this, () => this.#$ = cls.#insiderBaton);
			}

			static [$PASS](insider, receiver) {
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

	const instance = new TestSub();
	const insider = instance.getInsider();
	
	assertExists(insider);
	assertEquals(typeof insider, 'object');
	assertEquals(insider.initialized, true);
});

Deno.test('Sub class - baton should be cleared after handoff', () => {
	let batonValue = 'not-checked';
	
	const TestSub = (() => {
		const cls = Object.freeze(class TestSub extends TestBase {
			static #insiderBaton = null;
			#$;

			constructor() {
				super();
				TestBase[$GET](cls, this, () => {
					this.#$ = cls.#insiderBaton;
					batonValue = cls.#insiderBaton;
				});
			}

			static [$PASS](insider, receiver) {
				cls.#insiderBaton = insider;
				receiver();
				cls.#insiderBaton = null;
			}

			static checkBatonAfterConstruction() {
				return cls.#insiderBaton;
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	const instance = new TestSub();
	
	// Baton should have been set during receiver call
	assertExists(batonValue);
	assertEquals(typeof batonValue, 'object');
	
	// Baton should be null after construction completes
	assertEquals(TestSub.checkBatonAfterConstruction(), null);
});

Deno.test('Sub class - multiple instances should each receive their own insider', () => {
	const TestSub = (() => {
		const cls = Object.freeze(class TestSub extends TestBase {
			static #insiderBaton = null;
			#$;

			constructor() {
				super();
				TestBase[$GET](cls, this, () => this.#$ = cls.#insiderBaton);
			}

			static [$PASS](insider, receiver) {
				cls.#insiderBaton = insider;
				receiver();
				cls.#insiderBaton = null;
			}

			getInsider() {
				return this.#$;
			}

			setInsiderProp(key, value) {
				this.#$[key] = value;
			}

			getInsiderProp(key) {
				return this.#$[key];
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	const instance1 = new TestSub();
	const instance2 = new TestSub();
	
	const insider1 = instance1.getInsider();
	const insider2 = instance2.getInsider();
	
	// Each instance should have its own insider object
	assertEquals(insider1 !== insider2, true);
	
	// Modifying one shouldn't affect the other
	instance1.setInsiderProp('test', 'value1');
	instance2.setInsiderProp('test', 'value2');
	
	assertEquals(instance1.getInsiderProp('test'), 'value1');
	assertEquals(instance2.getInsiderProp('test'), 'value2');
});

Deno.test('Sub class - insider should persist across method calls', () => {
	const TestSub = (() => {
		const cls = Object.freeze(class TestSub extends TestBase {
			static #insiderBaton = null;
			#$;

			constructor() {
				super();
				TestBase[$GET](cls, this, () => this.#$ = cls.#insiderBaton);
			}

			static [$PASS](insider, receiver) {
				cls.#insiderBaton = insider;
				receiver();
				cls.#insiderBaton = null;
			}

			setInsiderProp(key, value) {
				this.#$[key] = value;
			}

			getInsiderProp(key) {
				return this.#$[key];
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	const instance = new TestSub();
	
	instance.setInsiderProp('prop1', 'value1');
	instance.setInsiderProp('prop2', 'value2');
	
	assertEquals(instance.getInsiderProp('prop1'), 'value1');
	assertEquals(instance.getInsiderProp('prop2'), 'value2');
});

Deno.test('Sub class - should use ||= to prevent insider reassignment', () => {
	const TestSub = (() => {
		const cls = Object.freeze(class TestSub extends TestBase {
			static #insiderBaton = null;
			#$;

			constructor() {
				super();
				TestBase[$GET](cls, this, () => this.#$ ||= cls.#insiderBaton);
				this.#$.original = true;
			}

			static [$PASS](insider, receiver) {
				cls.#insiderBaton = insider;
				receiver();
				cls.#insiderBaton = null;
			}

			getInsider() {
				return this.#$;
			}

			tryReassign() {
				const newInsider = { fake: true };
				this.#$ ||= newInsider;
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	const instance = new TestSub();
	const originalInsider = instance.getInsider();
	
	assertEquals(originalInsider.original, true);
	
	// Try to reassign
	instance.tryReassign();
	
	// Should still have the original insider
	const currentInsider = instance.getInsider();
	assertEquals(currentInsider.original, true);
	assertEquals(currentInsider.fake, undefined);
	assertEquals(currentInsider === originalInsider, true);
});

Deno.test('Sub class - multi-level inheritance should work', () => {
	const TestSub = (() => {
		const cls = Object.freeze(class TestSub extends TestBase {
			static #insiderBaton = null;
			#$;

			constructor() {
				super();
				TestBase[$GET](cls, this, () => this.#$ = cls.#insiderBaton);
				this.#$.level = 'sub';
			}

			static [$PASS](insider, receiver) {
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

	const TestSubSub = (() => {
		const cls = Object.freeze(class TestSubSub extends TestSub {
			static #insiderBaton = null;
			#$;

			constructor() {
				super();
				TestBase[$GET](cls, this, () => this.#$ = cls.#insiderBaton);
				this.#$.sublevel = 'subsub';
			}

			static [$PASS](insider, receiver) {
				cls.#insiderBaton = insider;
				receiver();
				cls.#insiderBaton = null;
			}

			getSubSubInsider() {
				return this.#$;
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	const instance = new TestSubSub();
	const subInsider = instance.getInsider();
	const subSubInsider = instance.getSubSubInsider();
	
	// Both should reference the same object
	assertEquals(subInsider === subSubInsider, true);
	assertEquals(subInsider.level, 'sub');
	assertEquals(subInsider.sublevel, 'subsub');
});

Deno.test('Sub class - $PASS should properly handle receiver function', () => {
	let receiverCalled = false;
	let receivedInsider = null;
	
	const TestSub = (() => {
		const cls = Object.freeze(class TestSub extends TestBase {
			static #insiderBaton = null;
			#$;

			constructor() {
				super();
				TestBase[$GET](cls, this, () => {
					receiverCalled = true;
					receivedInsider = cls.#insiderBaton;
					this.#$ = cls.#insiderBaton;
				});
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

	const instance = new TestSub();
	
	assertEquals(receiverCalled, true);
	assertExists(receivedInsider);
	assertEquals(typeof receivedInsider, 'object');
});

Deno.test('Sub class - should get null #$ for mismatched class (Sub2 $GET passing Sub1)', () => {
	// Create two different trusted sub-classes
	const TestSub1 = (() => {
		const cls = Object.freeze(class TestSub1 extends TestBase {
			static #insiderBaton = null;
			#$;

			constructor() {
				super();
				TestBase[$GET](cls, this, () => this.#$ = cls.#insiderBaton);
				this.#$.class = 'Sub1';
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

	let receivedInsider = undefined;

	const TestSub2 = (() => {
		const cls = Object.freeze(class TestSub2 extends TestBase {
			static #insiderBaton = null;
			#$;

			constructor() {
				super();
				TestBase[$GET](TestSub1 /*[sic]*/, this, () => this.#$ = cls.#insiderBaton);
				receivedInsider = this.#$;
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

	new TestSub2();
	
	assertEquals(receivedInsider, null);
});

Deno.test('Sub class - cross-instance access works across different trusted classes', () => {
	const TestSub = (() => {
		const cls = Object.freeze(class TestSub extends TestBase {
			static #insiderBaton = null;
			#$;

			constructor(id) {
				super();
				TestBase[$GET](cls, this, () => this.#$ = cls.#insiderBaton);
				this.#$.id = id;
			}

			static [$PASS](insider, receiver) {
				cls.#insiderBaton = insider;
				receiver();
				cls.#insiderBaton = null;
			}

			// Access another instance's insider (different class)
			compareTo(other) {
				let otherInsider;
				// #$ is always passed by common Base,
				// but request must come from trusted class
				TestBase[$GET](cls, other, () => otherInsider = cls.#insiderBaton);
				return { insider: this.#$, otherInsider };
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	const baseInst = new TestBase();
	const subInst = new TestSub('sub');
	const { insider, otherInsider } = subInst.compareTo(baseInst);
	
	// Cross-instance/cross-type access should work
	assertEquals(typeof insider, 'object');
	assertEquals(typeof otherInsider, 'object');
	assert(insider !== otherInsider);
	assertEquals(insider.id, 'sub');
	assertEquals(otherInsider.id, undefined);
});

Deno.test('Sub class - $PASS should use try/finally for safety', () => {
	let batonCleared = false;
	
	const TestSub = (() => {
		const cls = Object.freeze(class TestSub extends TestBase {
			static #insiderBaton = null;
			#$;

			constructor(shouldThrow = false) {
				super();
				TestBase[$GET](cls, this, () => {
					this.#$ = cls.#insiderBaton;
					if (shouldThrow) throw new Error('Test error');
				});
			}

			static [$PASS](insider, receiver) {
				cls.#insiderBaton = insider;
				try {
					receiver();
				} finally {
					cls.#insiderBaton = null;
					batonCleared = true;
				}
			}
		});
		Object.freeze(cls.prototype);
		return cls;
	})();

	// Normal case - baton should be cleared
	batonCleared = false;
	new TestSub(false);
	assertEquals(batonCleared, true);

	// Error case - baton should still be cleared
	batonCleared = false;
	try {
		new TestSub(true);
	} catch (e) {
		// Expected error
	}
	assertEquals(batonCleared, true);
});
