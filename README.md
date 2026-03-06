# insider-js

A pattern for implementing "insider" (trusted-only) properties in native JavaScript using ES2022 private fields and explicit trust declarations.

## Overview

JavaScript's private fields (`#`) provide class-level encapsulation, but sometimes you need to share private state across a controlled set of trusted classes while preventing access from untrusted subclasses. This library provides a secure pattern to implement "insider" properties—private state shared only among explicitly trusted classes in a hierarchy.

## Features

- **Trusted-Only Access**: Properties accessible only within explicitly trusted classes
- **Untrusted Subclass Protection**: Prevents untrusted subclasses from accessing insider state
- **Cross-Instance Access**: Supports insider property access across instances of trusted classes
- **Secure Handoff Pattern**: Uses a baton-passing mechanism to safely transfer private references
- **Zero Dependencies**: Pure JavaScript implementation
- **Type Safe**: Works seamlessly with TypeScript
- **Lightweight**: Minimal overhead with efficient trust verification

## Pattern Application

### Trust Declaration Pattern

Define which classes are trusted to access insider state. From [`insider-trusted.js`](insider-trusted.js):

```javascript
// "Barrel" bundling of base + trusted sub-classes
import { Base } from './insider-base.js';
import { Partner } from './insider-partner.js';
import { Sub } from './insider-sub.js';
export { Base, Partner, Sub };

let trusted;

/**
 * Is a class on the trusted list?
 * @param {Class} cls - The class object in question
 * @returns {boolean} Whether the class is on the trusted list
 */
export const isTrusted = (cls) => {
	// Adjust the trusted-class array (or Set) below as required
	trusted ||= [Sub, Partner]; // (Array) ideally, most common first
	// trusted ||= new Set([...]); // (Set) more performant for long lists
	return trusted.includes(cls); // trusted.has(cls) if using a Set
};
```

This abstraction allows for flexible implementation options:
- **Array**: Simple and efficient for small lists (use `.includes()`)
- **Set**: Better performance for larger lists (use `.has()`)
- **Switch/if statements**: Direct logic for specific classes
- **Other data structures**: Any approach that returns a boolean

### Base-Class Pattern

Incorporate the base-class pattern into your base class. Excerpted from [`insider-base.js`](insider-base.js):

```javascript
// Base-class insider-pattern essentials
import { isTrusted } from './insider-trusted.js';

export const Base = (() => {
	const cls = Object.freeze(class Base {
		static #insiderBaton = null; // Per-class handoff baton
		static #protoInsider = Object.freeze({
			insiderMethod() {
				// When called as `this.#insider.method` (or `insider.method`):
				// `this` is the insider state object
				// `this.thys` is the original object (see constructor)
				if (this !== this.thys.#insider) throw new Error('Unauthorized call');
				// ...
			}
		});
		#insider; /* Instance insider properties */

		constructor() {
			const insider = this.#insider = Object.create(cls.#protoInsider);
			insider.thys = this; // Enables insider methods without per-instance binding
		}

		/*
		 * Base-class-only class-method to pass #insider access
		 * @param {Class} reqCls - The requesting method's class (for proper handoff)
		 * @param {Object} instance - The instance whose #insider is requested
		 * @param {Function} receiver - Baton-receiver/instance-#insider-setter function
		 */
		static _getInsider (reqCls, instance, receiver) {
			// Request must be for a class on the trusted list
			if (!isTrusted(reqCls)) throw new Error('Untrusted request');
			// Make sure the handoff class-method is a frozen function
			const passProps = Object.getOwnPropertyDescriptor(reqCls, '_passInsider');
			if (typeof passProps.value !== 'function' || passProps.writable !== false || passProps.configurable !== false) throw new Error('Unsafe handoff');
			// Use the supplied class-level handoff method to pass #insider to the receiver
			reqCls._passInsider(instance.#insider, receiver);
		}
	});
	Object.freeze(cls.prototype);
	return cls;
})();
```

**Key features:**
- **Prototype-based insider methods**: The `#protoInsider` object contains shared methods accessible to all insider base (and sub-class) instances
- **`thys` reference**: Each insider has a `thys` property pointing back to the original instance, enabling method calls without per-instance binding
- **Security validation**: Insider methods verify they're called on the correct insider object to prevent unauthorized access

### Sub-Class Pattern

Incorporate the sub-class pattern into your trusted sub-classes. Excerpted from [`insider-sub.js`](insider-sub.js):

```javascript
// Sub-class insider-pattern essentials
import { Base } from './insider-trusted.js';

const getProto = Object.getPrototypeOf, setProto = Object.setPrototypeOf;

export const Sub = (() => {
	const cls = Object.freeze(class Sub extends Base {
		static #insiderBaton = null; // Handoff baton
		static #protoInsider = setProto({
			insiderMethod() {
				// When called as `this.#insider.method` (or `insider.method`):
				// `this` is the insider state object
				// `this.thys` is the original object (see constructor)
				if (this !== this.thys.#insider) throw new Error('Unauthorized call');
				// super.insiderMethod();
			}
		}, null);
		#insider; // Per-class-level private view of shared #insider state

		constructor () {
			super();
			// Request this instance's #insider using our class-level static handoff method
			// and a receiver that loads the instance #insider from the static baton
			Base._getInsider(cls, this, () => this.#insider = cls.#insiderBaton);
			const insider = this.#insider;
			// Fix #insider prototypes
			if (!getProto(cls.#protoInsider)) Object.freeze(setProto(cls.#protoInsider, getProto(insider)));
			setProto(insider, cls.#protoInsider);
		}

		/*
		 * Baton handoff function (all sub-classes); called by Base._getInsider
		 * @param {Object} insider - The requested instance's #insider
		 * @param {Function} receiver - The receiver function to call
		 */
		static _passInsider (insider, receiver) {
			/*
			 * Put the instance's #insider into the baton long enough
			 * for the handoff and then remove it.
			 */
			cls.#insiderBaton = insider;
			try { receiver(); } // Receiver must be a cls method to accept the baton
			finally { cls.#insiderBaton = null; }
		}
	});
	Object.freeze(cls.prototype);
	return cls;
})();
```

**Key features:**
- **Prototype chain management**: Sub-classes can define their own insider methods that extend Base's insider methods
- **`try/finally` safety**: Ensures the baton is always cleared, even if the receiver throws an error
- **Method inheritance**: Sub-class insider methods can call `super.insiderMethod()` to invoke ancestor insider methods

### Partner-Class Pattern (Non-Inheritance Variant)

The insider pattern also supports trusted partner classes that are not part of the inheritance hierarchy. This is useful for composition-based designs where a partner class needs private access to an unrelated Base class instance's insider state. Excerpted from [`insider-partner.js`](insider-partner.js):

```javascript
// Partner-class insider-pattern variant
import { Base } from './insider-trusted.js';

export const Partner = (() => {
	const cls = Object.freeze(class Partner { // Unrelated to Base
		static #insiderBaton;
		#insider;

		constructor (baseInstance) {
			// Accept base instance parameter instead of using `this`
			Base._getInsider(cls, baseInstance, () => this.#insider = cls.#insiderBaton);
			// Insider properties (this.#insider.prop) now available here
		}

		// Standard handoff-pattern class-method
		static _passInsider (insider, receiver) {
			cls.#insiderBaton = insider;
			try { receiver(); }
			finally { cls.#insiderBaton = null; }
		}

		/**
		 * Pseudo-insider method (public, but caller must confirm it knows #insider)
		 * partnerInstance.gatedMethod(this.#insider)
		 * @param {*} insider - The insider-properties object
		 */
		gatedMethod (insider) {
			if (insider !== this.#insider) throw new Error('Unauthorized');
			// Method implementation with insider access
		}
	});
	Object.freeze(cls.prototype);
	return cls;
})();
```

**Additional pattern - Gated Methods:**

Partner classes can expose "gated" public methods that require the caller to prove they have insider access by passing the insider object as a parameter. This allows trusted classes to call methods on partner instances while preventing untrusted code from doing so.

**Key differences from the Sub-Class pattern:**

1. **No inheritance**: The Partner class does not extend Base
2. **Instance parameter**: The constructor accepts a Base instance rather than calling `super()`
3. **Trust list inclusion**: The Partner class must still be added to the trusted classes list in [`insider-trusted.js`](insider-trusted.js)

**Use cases for the partner pattern:**

- **Composition over inheritance**: When using composition-based design patterns
- **Cross-hierarchy access**: Allowing classes from different hierarchies to work with Base instances
- **Adapter/Wrapper patterns**: Creating adapters or wrappers that need insider access
- **Service classes**: Utility or service classes that operate on Base instances

**Security note**: Since the pattern doesn't verify inheritance relationships, any class in the trust list can access Base instances' insider state. Trust must be carefully managed.

## Cross-Instance Insider Access

Trusted classes can optionally access insider state from other instances as follows:

```javascript
class Sub extends Base {
    // ...

	// OPTIONAL: Get another instance's #insider
	// (sub-class version)
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
}
```

## Insider Methods

The pattern supports defining methods on the insider object itself, which provides a secure way to encapsulate insider-only operations:

```javascript
static #protoInsider = Object.freeze({
	insiderMethod() {
		// `this` is the insider state object
		// `this.thys` is the original instance
		if (this !== this.thys.#insider) throw new Error('Unauthorized call');
		
		// Access insider properties
		this.someInsiderProperty = 'value';
		
		// Access the original instance
		this.thys.publicMethod();
	}
});
```

**Key benefits:**
- **No per-instance binding**: Methods are shared via the prototype chain, not duplicated per instance
- **Security validation**: Methods verify they're called on the correct insider object
- **`thys` reference**: Provides access back to the original instance without binding overhead
- **Inheritance support**: Sub-classes can extend insider methods using the prototype chain

**Usage:**
```javascript
// In a trusted class method
this.#insider.insiderMethod(); // Calls the method with proper context
```

## How The Pattern Works

The pattern uses five key mechanisms:

1. **Private Fields (`#insider`)**: Each trusted class in the hierarchy has its own private `#insider` field that references the same shared insider properties object.

2. **Trust Verification**: The `isTrusted()` function checks whether a class is allowed to access insider state, with flexible implementation options (Array, Set, switch statements, etc.).

3. **Baton Handoff**: A secure handoff mechanism uses a temporary static baton to pass the `#insider` reference from the base class to trusted sub-classes and partner classes. The baton is cleared in a `try/finally` block to ensure cleanup even if errors occur.

4. **Security Verification**: The base class verifies that requesting classes pass the trust check and that their handoff methods are properly frozen before granting access.

5. **Prototype-Based Methods**: Insider objects inherit from a frozen prototype containing shared methods, enabling efficient method sharing without per-instance duplication. The `thys` reference provides access back to the original instance, efficiently eliminating the need for per-instance binding.

## Property Access Levels

```javascript
class Example extends Base {
    #insider;
    #privateField;  // Private: only accessible in this class

    constructor () {
        super();
        Base._getInsider(cls, this, () => this.#insider = cls.#insiderBaton);

        this.publicField = 'public';           // Public: accessible everywhere
        this.#insider.insiderField = 'insider'; // Insider: accessible in trusted classes only
        this.#privateField = 'private';        // Private: only in this class
    }
}
```

## Security Considerations

The pattern includes several security measures:

- **Frozen Classes**: Classes and prototypes are frozen to prevent tampering
- **Trust Verification**: Only explicitly trusted classes can access insider state
- **Handoff Validation**: The base class verifies that handoff methods are frozen and non-configurable
- **Temporary Baton**: The insider reference is only available during the handoff and immediately cleared

**Note**: For maximum security in production environments, you should `Object.freeze(Object)` before any untrusted code can run to prevent prototype pollution attacks.

## Use Cases

The insider pattern is ideal for:

- **Framework Internals**: Sharing state between framework classes while preventing user subclasses from accessing it
- **Plugin Systems**: Allowing trusted plugins to access internal state while blocking untrusted ones
- **Security-Critical Code**: Implementing access control where only specific classes should have access to sensitive data
- **API Boundaries**: Creating clear trust boundaries in large applications

## Browser Support

Works in all modern browsers and Deno / Node.js / etc. environments that support:
- ES6 Classes
- Private fields (`#`)
- ES2015 Modules

## License

This content is placed in the public domain by the author.

## Resources

- [Blog Post: JavaScript Object Property Encapsulation: Beyond Public, Protected, and Private](https://www.kappacs.com/javascript-object-property-encapsulation-beyond-public-protected-and-private/)
- Author: Brian Katzung <briank@kappacs.com>

## Contributing

This is a pattern demonstration. Feel free to adapt it to your needs or suggest improvements via issues and pull requests.
