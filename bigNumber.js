/**
 * Big Number arithmetic using string representation.
 * Supports: +, -, *, /, %, ^ (power)
 * Division uses long division; power uses binary exponentiation.
 */
(function(window) {
    'use strict';

    function trimLeadingZeros(s) {
        var i = 0;
        while (i < s.length && s[i] === '0') i++;
        return i < s.length ? s.substring(i) : '0';
    }

    function isZero(s) {
        return trimLeadingZeros(s) === '0';
    }

    function compare(a, b) {
        a = trimLeadingZeros(a);
        b = trimLeadingZeros(b);
        if (a.length !== b.length) return a.length > b.length ? 1 : -1;
        for (var i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return parseInt(a[i], 10) > parseInt(b[i], 10) ? 1 : -1;
        }
        return 0;
    }

    function add(a, b) {
        a = a.replace(/^0+/, '') || '0';
        b = b.replace(/^0+/, '') || '0';
        var maxLen = Math.max(a.length, b.length);
        a = a.padStart(maxLen, '0');
        b = b.padStart(maxLen, '0');
        var result = '';
        var carry = 0;
        for (var i = maxLen - 1; i >= 0; i--) {
            var sum = parseInt(a[i], 10) + parseInt(b[i], 10) + carry;
            result = (sum % 10) + result;
            carry = Math.floor(sum / 10);
        }
        if (carry) result = carry + result;
        return trimLeadingZeros(result);
    }

    function subtract(a, b) {
        a = a.replace(/^0+/, '') || '0';
        b = b.replace(/^0+/, '') || '0';
        if (compare(a, b) < 0) return '-' + subtract(b, a);
        var maxLen = Math.max(a.length, b.length);
        a = a.padStart(maxLen, '0');
        b = b.padStart(maxLen, '0');
        var result = '';
        var borrow = 0;
        for (var i = maxLen - 1; i >= 0; i--) {
            var d = parseInt(a[i], 10) - parseInt(b[i], 10) - borrow;
            if (d < 0) { d += 10; borrow = 1; } else { borrow = 0; }
            result = d + result;
        }
        return trimLeadingZeros(result);
    }

    function multiply(a, b) {
        a = a.replace(/^0+/, '') || '0';
        b = b.replace(/^0+/, '') || '0';
        if (a === '0' || b === '0') return '0';
        var result = '0';
        var bLen = b.length;
        for (var i = bLen - 1; i >= 0; i--) {
            var partial = '';
            var carry = 0;
            var aLen = a.length;
            for (var j = aLen - 1; j >= 0; j--) {
                var p = parseInt(a[j], 10) * parseInt(b[i], 10) + carry;
                partial = (p % 10) + partial;
                carry = Math.floor(p / 10);
            }
            if (carry) partial = carry + partial;
            partial += Array(bLen - 1 - i + 1).join('0');
            result = add(result, partial);
        }
        return result;
    }

    /**
     * Long division - manual algorithm (like hand division).
     * Returns quotient with decimal part, stopping after decimalPlaces digits.
     */
    function divide(a, b, decimalPlaces) {
        a = a.replace(/^0+/, '') || '0';
        b = b.replace(/^0+/, '') || '0';
        if (isZero(b)) throw new Error('Division by zero');
        decimalPlaces = decimalPlaces || 0;
        var result = '';
        var remainder = '0';

        for (var i = 0; i < a.length; i++) {
            remainder = add(multiply(remainder, '10'), a[i]);
            var q = 0;
            while (compare(remainder, b) >= 0) {
                remainder = subtract(remainder, b);
                q++;
            }
            result += q;
        }

        if (decimalPlaces > 0) {
            result += '.';
            for (var j = 0; j < decimalPlaces; j++) {
                remainder = multiply(remainder, '10');
                var q = 0;
                while (compare(remainder, b) >= 0) {
                    remainder = subtract(remainder, b);
                    q++;
                }
                result += q;
            }
        }

        var intPart = result.split('.')[0];
        intPart = intPart.replace(/^0+/, '') || '0';
        var decPart = result.indexOf('.') >= 0 ? result.substring(result.indexOf('.')) : '';
        result = intPart + decPart;
        if (result.indexOf('.') === 0) result = '0' + result;
        return result || '0';
    }

    function modulo(a, b) {
        a = a.replace(/^0+/, '') || '0';
        b = b.replace(/^0+/, '') || '0';
        if (isZero(b)) throw new Error('Modulo by zero');
        if (compare(a, b) < 0) return a;
        var q = divide(a, b, 0);
        var dotIdx = q.indexOf('.');
        if (dotIdx >= 0) q = q.substring(0, dotIdx);
        var prod = multiply(q, b);
        return subtract(a, prod);
    }

    /**
     * Binary exponentiation (fast power / double-and-multiply).
     * base^exp where exp is non-negative integer.
     */
    function power(base, exp) {
        base = base.replace(/^0+/, '') || '0';
        exp = exp.replace(/^0+/, '') || '0';
        if (isZero(exp)) return '1';
        if (exp === '1') return base;
        if (isZero(base)) return '0';

        var halfExp = divByTwo(exp);
        var halfPow = power(base, halfExp);
        var sq = multiply(halfPow, halfPow);
        if (isOdd(exp)) {
            return multiply(sq, base);
        }
        return sq;
    }

    function divByTwo(s) {
        s = trimLeadingZeros(s);
        if (s === '0' || s === '1') return '0';
        var result = '';
        var carry = 0;
        for (var i = 0; i < s.length; i++) {
            var d = carry * 10 + parseInt(s[i], 10);
            result += Math.floor(d / 2);
            carry = d % 2;
        }
        return trimLeadingZeros(result);
    }

    function isOdd(s) {
        s = trimLeadingZeros(s);
        var last = s[s.length - 1];
        return last === '1' || last === '3' || last === '5' || last === '7' || last === '9';
    }

    function parseIntegerPart(s) {
        s = s.trim().replace(/,/g, '');
        var match = s.match(/^-?(\d+)/);
        return match ? match[1] : null;
    }

    function parsePositiveInt(s) {
        s = s.trim().replace(/,/g, '').replace(/\.\d*$/, '');
        if (/^\d+$/.test(s)) return s;
        return null;
    }

    var _bigmath = null;
    function getBigMath() {
        if (!_bigmath && typeof math !== 'undefined' && math.create) {
            _bigmath = math.create({ number: 'BigNumber', precision: 500 });
            if (math.import) {
                _bigmath.import({ ln: _bigmath.log });
            }
        }
        return _bigmath;
    }

    /**
     * Advanced expression evaluator using math.js BigNumber engine.
     * Supports parentheses, decimals, and advanced functions (sqrt, ln, sin, cos, etc.).
     */
    function evaluate(expr, decimalPlaces) {
        expr = expr.trim().replace(/,/g, '');
        decimalPlaces = decimalPlaces || 0;

        var bm = getBigMath();
        if (!bm) {
            throw new Error('math.js library is missing or cannot create BigNumber instance');
        }

        var result = bm.evaluate(expr);
        
        // Format the output to strictly use fixed notation (no scientific notation)
        if (decimalPlaces > 0) {
            return bm.format(bm.round(result, decimalPlaces), { notation: 'fixed' });
        } else {
            return bm.format(bm.round(result, 0), { notation: 'fixed' });
        }
    }

    function formatWithCommas(s) {
        var sign = '';
        if (s.charAt(0) === '-') {
            sign = '-';
            s = s.substring(1);
        }
        var parts = s.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return sign + parts.join('.');
    }

    /**
     * Modular exponentiation: base^exp mod n
     */
    function modPow(base, exp, n) {
        base = base.replace(/^0+/, '') || '0';
        exp = exp.replace(/^0+/, '') || '0';
        n = n.replace(/^0+/, '') || '0';
        if (isZero(n)) throw new Error('modPow: mod by zero');
        base = modulo(base, n);
        if (base === '0') return '0';
        var result = '1';
        while (compare(exp, '0') > 0) {
            if (isOdd(exp)) {
                result = modulo(multiply(result, base), n);
            }
            exp = divByTwo(exp);
            base = modulo(multiply(base, base), n);
        }
        return result;
    }

    var MR_BASES = ['2', '3', '5', '7', '11', '13', '17', '19', '23', '29', '31', '37', '41', '43', '47', '53', '59', '61', '67', '71'];
    var TEN_12 = '1000000000000';

    /**
     * Miller-Rabin primality test.
     * Uses string arithmetic only - no parseInt/Number for the tested value.
     * Returns { prime: boolean, millerRabin: boolean }.
     */
    function isPrime(n) {
        n = n.replace(/^0+/, '') || '0';
        if (n.charAt(0) === '-') n = n.substring(1);
        if (compare(n, '2') < 0) return { prime: false, millerRabin: false };
        if (n === '2') return { prime: true, millerRabin: false };
        if (!isOdd(n)) return { prime: false, millerRabin: false };

        var k = compare(n, TEN_12) > 0
            ? Math.min(40, Math.max(10, Math.ceil(n.length * 3.32)))
            : 7;

        for (var i = 0; i < k; i++) {
            var a = MR_BASES[i % MR_BASES.length];
            if (compare(a, subtract(n, '2')) >= 0) break;
            if (!millerRabinRound(n, a)) return { prime: false, millerRabin: true };
        }
        return { prime: true, millerRabin: true };
    }

    function millerRabinRound(n, a) {
        var nm1 = subtract(n, '1');
        var d = nm1;
        var s = 0;
        while (!isOdd(d)) {
            d = divByTwo(d);
            s++;
        }
        var x = modPow(a, d, n);
        if (x === '1' || x === nm1) return true;
        for (var r = 0; r < s; r++) {
            var y = modulo(multiply(x, x), n);
            if (y === '1' && x !== '1' && x !== nm1) return false;
            x = y;
            if (x === nm1) return true;
        }
        if (x !== '1') return false;
        return true;
    }

    window.BigNumber = {
        add: add,
        subtract: subtract,
        multiply: multiply,
        divide: divide,
        modulo: modulo,
        power: power,
        evaluate: evaluate,
        formatWithCommas: formatWithCommas,
        compare: compare,
        isZero: isZero,
        isPrime: isPrime,
        modPow: modPow
    };
})(typeof window !== 'undefined' ? window : this);
