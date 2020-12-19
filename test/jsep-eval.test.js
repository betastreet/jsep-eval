// tests
const _ = require('lodash');
const JsepEval = require('../src/jsep-eval');

const EPSILON = 0.0000001;

const name = 'jsep-eval';
describe('======== ' + name + ' =========', () => {
  let jsepEval;
  beforeEach(() => {
    jsepEval = new JsepEval();
  });

  describe('\n\t=== evaluations ====', () => {
    test(name + ': evaluate a literal expression', () => {
      const exp = '43.4';
      expect(jsepEval.evaluate(exp)).toEqual(43.4);
    });
    test(name + ': evaluate a compound expression', () => {
      const exp = '1, 2, 3';
      expect(jsepEval.evaluate(exp)).toEqual(3);
    });
    test(name + ': evaluate a conditional expression (true)', () => {
      const exp = 'true ? 1 : 2';
      expect(jsepEval.evaluate(exp)).toEqual(1);
    });
    test(name + ': evaluate a conditional expression (false)', () => {
      const exp = 'false ? 1 : 2';
      expect(jsepEval.evaluate(exp)).toEqual(2);
    });
    test(name + ': evaluate an array expression', () => {
      const exp = '[1, 2, 3]';
      const res = jsepEval.evaluate(exp);
      expect(res[2]).toEqual(3);
    });
    test(name + ': evaluate a call expression', () => {
      const exp = 'a()';
      const ctx = {a: () => 2};
      expect(jsepEval.evaluate(exp, ctx)).toEqual(2);
    });
    test(name + ': evaluate a call expression with an arg', () => {
      const exp = 'a(b)';
      const ctx = {a: arg => 2 * arg, b: 3};
      expect(jsepEval.evaluate(exp, ctx)).toEqual(6);
    });
    test(name + ': evaluate a "this" expression', () => {
      const exp = 'this';
      const ctx = {};
      expect(jsepEval.evaluate(exp, ctx)).toEqual(ctx);
    });
    test(name + ': evaluate a "this" member expression', () => {
      const exp = 'this.a';
      const ctx = {a: 2};
      expect(jsepEval.evaluate(exp, ctx)).toEqual(2);
    });
    test(name + ': evaluate a "this" call expression', () => {
      const exp = 'this()';
      const ctx = () => 2;
      expect(jsepEval.evaluate(exp, ctx)).toEqual(2);
    });
    test(name + ': equality operator should work for numbers', () => {
      expect(jsepEval.evaluate('4 === 4')).toBe(true);
    });
    test(name + ': should compute an identifier', () => {
      const ctx = {a: 1};
      const exp = 'a';
      expect(jsepEval.evaluate(exp, ctx)).toEqual(1);
    });
    test(name + ': should do mathematical ops', () => {
      const ctx = {aa: -2};
      const exp = 'aa +3  -7 * 2.2'; // -14.4
      const res = jsepEval.evaluate(exp, ctx);
      expect(Math.abs(res + 14.4) < EPSILON).toBe(true);
    });
    test(name + ': should compute a computed member expression', () => {
      const ctx = {
        a: {b: 2},
        c: 'b'
      };
      const exp = 'a[c]';
      expect(jsepEval.evaluate(exp, ctx)).toEqual(2);
    });
    test(name + ': should compute a non-computed compound member expression', () => {
      const ctx = {
        a: {b: {c: {d: 3}}},
      };
      const exp = 'a.b.c.d === 3';
      expect(jsepEval.evaluate(exp, ctx)).toBe(true);
    });
    test(name + ': should compute a complex, mixed compound member expression', () => {
      const ctx = {
        a: {b: {c: 7}},
        b: {d: 'e'},
        c: 'd',
        d: {e: 'c'}
      };
      const exp = 'a.b[d[b[c]]]';
      expect(jsepEval.evaluate(exp, ctx)).toEqual(7);
    });
  });

  describe('\n\t=== throws ===', () => {
    test('should throw when expression is invalid', () => {
      const ctx = {};
      const exp = 'a ***';
      expect(() => jsepEval.evaluate(exp, ctx)).toThrow();
    });
  });

  describe('\n\t=== modifications ===', () => {
    test(name + ': should be possible to remove an expression type', () => {
      jsepEval.removeType('BINARY');
      const exp = '2 + 2';
      expect(() => jsepEval.evaluate(exp)).toThrow();
    });
    test(name + ': should be possible to remove an binary operator', () => {
      jsepEval.removeBinaryOp('===');
      const exp = '2 === 2';
      expect(() => jsepEval.evaluate(exp)).toThrow();
    });
    test(name + ': should be possible to remove an unary operator', () => {
      jsepEval.removeUnaryOp('!');
      const exp = '!true';
      expect(() => jsepEval.evaluate(exp)).toThrow();
    });
    test(name + ': should be possible to replace an operator', () => {
      jsepEval.addUnaryOp('!', () => 'bob');
      const exp = '!false';
      expect(jsepEval.evaluate(exp)).toEqual('bob');
    });
  });

  describe('\n\t=== jsepEval.peval( (promise wrapper) ===', () => {
    test('should reject for case where evaluate throws an error', () => {
      const ctx = {
        a: {b: {c: {d: 3}}},
      };
      const exp = 'a ***';
      return expect(jsepEval.peval(exp, ctx)).rejects.toThrow();
    });

    test('should evaluate correctly (example taken from above)', () => {
      return expect(jsepEval.peval('4 === 4')).resolves.toBe(true);
    });
  });
});
