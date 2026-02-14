# insider-js

A pattern for implementing "insider" (trusted-only) properties in native JavaScript using ES2022 private fields and explicit trust declarations.

## Overview

JavaScript's private fields (`#`) provide instance-level encapsulation, but sometimes you need to share private state across a controlled set of trusted classes while preventing access from untrusted subclasses. This library provides a secure pattern to implement "insider" properties—private state shared only among explicitly trusted classes in a hierarchy.

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
import { Sub } from './insider-sub.js';
export { Base, Sub };

let trusted;

// Return the trusted sub-class list
// (but not before the classes are initialized)
export const getTrusted = () => {
	// Adjust the trusted-class array below as required
	trusted ||= Object.freeze([Sub]);
	return trusted;
};
```

### Base-Class Pattern

Incorporate the base-class pattern into your base class. Excerpted from [`insider-base.js`](insider-base.js):

```javascript
// Base-class insider-pattern essentials
import { getTrusted } from './insider-trusted.js';

export const Base = (() => {
	const cls = Object.freeze(class Base {
		static #trusted; // Base-class cached trusted-sub-class array
		static #insiderBaton = null; // Per-class handoff baton
		#insider = { /* Instance insider properties */ };

		// Base-class constructor
		constructor () {
			// Cache trusted sub-class list upon first instantiation
			cls.#trusted ||= getTrusted();
		}

		/*
		 * Base-class-only class-method to pass #insider access
		 * @param {Class} reqCls - The requesting method's class (for proper handoff)
		 * @param {Object} instance - The instance whose #insider is requested
		 * @param {Function} receiver - Baton-receiver/instance-#insider-setter function
		 */
		static _getInsider (reqCls, instance, receiver) {
			// Request must be for a class on the trusted list
			if (!cls.#trusted.includes(reqCls)) throw new Error('Untrusted request');
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

### Sub-Class Pattern

Incorporate the sub-class pattern into your trusted sub-classes. Excerpted from [`insider-sub.js`](insider-sub.js):

```javascript
// Sub-class insider-pattern essentials
import { Base } from './insider-trusted.js';

export const Sub = (() => {
	const cls = Object.freeze(class Sub extends Base {
		static #insiderBaton = null; // Handoff baton
		#insider; // Per-class-level private view of shared #insider state

		constructor () {
			super();
			// Request this instance's #insider using our class-level static handoff method
			// and a receiver that loads the instance #insider from the static baton
			Base._getInsider(cls, this, () => this.#insider = cls.#insiderBaton);
		}

		/*
		 * Baton handoff function (all sub-classes); called by Base._getInsider
		 * @param {Object} insider - The requested instances #insider
		 * @param {Function} receiver - The receiver function to call
		 */
		static _passInsider (insider, receiver) {
			/*
			 * Put the instance's #insider into the baton long enough
			 * for the handoff and then remove it.
			 */
			cls.#insiderBaton = insider;
			receiver(); // Receiver must be a cls method to accept the baton
			cls.#insiderBaton = null;
		}
	});
	Object.freeze(cls.prototype);
	return cls;
})();
```

### Partner-Class Pattern (Non-Inheritance Variant)

The insider pattern also supports trusted partner classes that are not part of the inheritance hierarchy. This is useful for composition-based designs where a partner class needs private access to an unrelated Base class instance's insider state. Excerpted from [`insider-partner.js`](insider-partner.js):

```javascript
// Partner-class insider-pattern variant
import { Base } from './insider-trusted.js';

export const Partner = (() => {
	const cls = Object.freeze(class Partner { // Unrelated to Base
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
```

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

Trusted classes can access insider state from other instances in two ways:

```javascript
class Sub extends Base {
    // ...

	// OPTIONAL: Two ways to get another instance's #insider
	#getOtherInsider (other) {
		// #1: Only works if other instanceof cls (at least as derived in same hierarchy)
		const insider1 = other.#insider;
		
		// #2: Works for any instance (if called from a trusted-sub-class method)
		let insider2;
		Base._getInsider(cls, other, () => insider2 = cls.#insiderBaton);
		return insider2;
	}
}
```

## How The Pattern Works

The pattern uses four key mechanisms:

1. **Private Fields (`#insider`)**: Each trusted class in the hierarchy has its own private `#insider` field that references the same shared insider properties object.

2. **Trust List**: The base class maintains a frozen array of explicitly trusted classes that are allowed to access insider state.

3. **Baton Handoff**: A secure handoff mechanism uses a temporary static baton to pass the `#insider` reference from the base class to trusted subclasses.

4. **Security Verification**: The base class verifies that requesting classes are on the trust list and that their handoff methods are properly frozen before granting access.

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
