export const myConsole = Object.create(console, {
    assert: {
        value: function assert(assertion, message, ...args) {
            if (typeof window === "undefined") {
                try {
                    console.assert(assertion, message, ...args);
                } catch (err) {
                    console.error(err.stack);
                }
            } else {
                console.assert(assertion, message, ...args);
            }
        },
        configurable: true,
        enumerable: true,
        writable: true,
    },
});


// Stolen from
// https://github.com/ReactiveSets/toubkal/blob/master/lib/util/value_equals.js
export const equals = (a, b) => {


    let reference_equals = (a, b) => {
        let object_references: any[] = [];

        return (reference_equals = _reference_equals)(a, b);

        function _reference_equals(a, b) {
            let l = object_references.length;

            while (l--)
                if (object_references[l--] === b)
                    return object_references[l] === a;

            object_references.push(a, b);

            return null;
        }
    };

    const _equals = (a, b) => {
        // a and b have already failed test for strict equality or are zero

        let s, l, p, x, y;

        // They should have the same toString() signature
        if ((s = toString.call(a)) !== toString.call(b)) return false;

        switch (s) {
            default: // Boolean, Date, String
                return a.valueOf() === b.valueOf();

            case "[object Number]":
                // Converts Number instances into primitive values
                // This is required also for NaN test bellow
                a = +a;
                b = +b;

                return a ?         // a is Non-zero and Non-NaN
                    a === b
                    :                // a is 0, -0 or NaN
                    a === a ?      // a is 0 or -O
                        1 / a === 1 / b    // 1/0 !== 1/-0 because Infinity !== -Infinity
                        : b !== b        // NaN, the only Number not equal to itself!
                    ;
            // [object Number]

            case "[object RegExp]":
                return a.source === b.source
                    && a.global === b.global
                    && a.ignoreCase === b.ignoreCase
                    && a.multiline === b.multiline
                    && a.lastIndex === b.lastIndex
                    ;
            // [object RegExp]

            case "[object Function]":
                return false; // functions should be strictly equal because of closure context
            // [object Function]

            case "[object Array]":

                if ((l = a.length) !== b.length) return false;
                // Both have as many elements

                while (l--) {
                    if ((x = a[l]) === (y = b[l]) && x !== 0 || _equals(x, y)) continue;

                    return false;
                }

                return true;
            // [object Array]

            case "[object Object]":

                l = 0; // counter of own properties

                for (p in a) {
                    if (a.hasOwnProperty(p)) {
                        ++l;

                        if ((x = a[p]) === (y = b[p]) && x !== 0 || _equals(x, y)) continue;

                        return false;
                    }
                }

                // Check if "b" has as not more own properties than "a"
                for (p in b)
                    if (b.hasOwnProperty(p) && --l < 0)
                        return false;


                return true;
            // [object Object]
        } // switch toString.call( a )
    };

    return a === b       // strick equality should be enough unless zero
        && a !== 0         // because 0 === -0, requires test by _equals()
        || _equals(a, b); // handles not strictly equal or zero values
};