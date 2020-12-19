const _ = require('lodash');
const JsepEval = require('../src/jsep-eval');

const EPSILON = 0.0000001;

const name = 'jsep-eval';
describe('======== ' + name + ' =========', () => {
  let jsepEval;
  beforeEach(() => {
    jsepEval = new JsepEval();
  });

  describe('instance', () => {
    test(name + ': should return same instance', () => {
      expect(JsepEval.instance).toEqual(JsepEval.instance);
      expect(new JsepEval()).toEqual(JsepEval.instance);
    });
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

    test.each([
      ['"a" === "a"', true],
      ['"a" === "b"', false],
      ['1 === 1', true],
      ['"a" !== "b"', true],
      ['"a" !== "a"', false],
      ['"a" == "a"', true],
      ['"a" == "b"', false],
      ['1 == 1', true],
      ['1 == 2', false],
      ['"a" != "b"', true],
      ['"a" != "a"', false],
      ['1 != 2', true],
      ['1 != 1', false],
      ['2 > 1', true],
      ['2 > 2', false],
      ['2 < 5', true],
      ['2 < 2', false],
      ['2 >= 2', true],
      ['2 >= 5', false],
      ['2 <= 2', true],
      ['2 <= 1', false],
      ['1 + 10 - 2', 9],
      ['3 * 4 / 2', 6],
      ['3 % 2', 1],
      ['4 & 7', 0x04],
      ['4 | 7', 0x07],
      ['4 ^ 7', 0x03],
      ['4 << 1', 0x08],
      ['4 >> 1', 0x02],
      ['-4 >> 1', -2],
      ['-4 >>> 1', 0x7FFFFFFE],
      ['"" || 10', 10],
      ['"x" && 10', 10],
      ['!0', true],
      ['!!0', false],
      ['!!1', true],
      ['~1', -2],
      ['+"1"', 1],
      ['-"1"', -1],
    ])(name + ': %# should handle operators in expression %s', (expression, exp) => {
      expect(jsepEval.evaluate(expression))
        .toEqual(exp);
    });

    test.each([
      ['b.c()', 3],
      ['arr[b.c()-2]', 11],
      ['b.c', expect.any(Function)],
      ['b.c(7)', 7],
      ['arr[a]', 11],
      ['arr[2]', 3],
      ['fn()', 'a'],
      ['_.indexOf([1, 2, 3], 2)', 1],
      // ['arr.find(v => v === 11)', 11],
      // ['arr.findIndex(v => v === b.c())', 2],
      ['arr.findIndex(b.isEleven)', 1],
      // ['[1, 2].length + 1', 3],
      ['_.concat(["a", "bcd"], "ef").join(",").length * 2 || 0', 16],
    ])(name + ': %# Should support complex expression %s', (expression, exp) => {
      expect(jsepEval.evaluate(expression, {
        _,
        a: 1,
        b: {
          c: v => v || 3,
          d: 2,
          isEleven: v => v === 11,
        },
        arr: [10, 11, 3],
        fn: () => 'a',
      }))
        .toEqual(exp);
    });

    test.each([
      ['7 > myMethod(b)'],
      ['7 > _.myMethod(b)'],
    ])('%# Should throw for bad function %s', (expression) => {
      expect(() => jsepEval.evaluate(expression, {
        _,
        a: 1,
        b: 2,
      }))
        .toThrow('could not evaluate \'myMethod\'');
    });

    test(name + ': should return undefined from undefOperator', () => {
      expect(jsepEval.undefOperator()).toEqual(undefined);
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

    test(name + ': should support arrow functions with multi args', () => {
      // TODO: use jsep with arrow support
      // https://github.com/EricSmekens/jsep/pull/123
      // a.find((val, i) => i === 1)
      const tree = {
        type: 'CallExpression',
        arguments: [
          {
            type: 'ArrowFunctionExpression',
            params: [
              {
                type: 'Identifier',
                name: 'val'
              },
              {
                type: 'Identifier',
                name: 'i'
              }
            ],
            body: {
              type: 'BinaryExpression',
              operator: '===',
              left: {
                type: 'Identifier',
                name: 'i'
              },
              right: {
                type: 'Literal',
                value: 1,
                raw: '1'
              }
            }
          }
        ],
        callee: {
          type: 'MemberExpression',
          computed: false,
          object: {
            type: 'Identifier',
            name: 'a'
          },
          property: {
            type: 'Identifier',
            name: 'find'
          }
        }
      };
      expect(jsepEval.evaluateTree(tree, { a: ['fun', 'play', 'time']}))
        .toBe('play');
    });

    test(name + ': should support arrow function with no args', () => {
      // TODO: use jsep with arrow support
      // https://github.com/EricSmekens/jsep/pull/123
      // a.map(() => 'play')
      const tree = {
        type: 'CallExpression',
        arguments: [
          {
            type: 'ArrowFunctionExpression',
            params: null,
            body: {
              type: 'Literal',
              value: 'play',
              raw: 'play'
            }
          }
        ],
        callee: {
          type: 'MemberExpression',
          computed: false,
          object: {
            type: 'Identifier',
            name: 'a'
          },
          property: {
            type: 'Identifier',
            name: 'map'
          }
        }
      };
      expect(jsepEval.evaluateTree(tree, { a: [2, 4, 6]}))
        .toEqual(['play', 'play', 'play']);
    });
  });

  describe('\n\t=== throws ===', () => {
    test(name + ': should throw when expression is invalid', () => {
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

    test(name + ': should be possible to add/update a binary operator', () => {
      const stringEqual = (a, b) => _.isString(a) && _.isString(b) && a.localeCompare(b, undefined, { sensitivity: 'accent'}) === 0; // eslint-disable-line
      jsepEval.addBinaryOp('==', (a, b) => (a == b || stringEqual(a, b)));
      expect(jsepEval.evaluate('"a" == "A"')).toBe(true);
      expect(jsepEval.evaluate('"a" == "B"')).toBe(false);
    });

    test(name + ': should be possible to alias a binary operator', () => {
      jsepEval.aliasForBinaryOp('AND', '&&');
      expect(jsepEval.evaluate('true AND !false')).toBe(true);
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

    test(name + ': should be possible to alias a unary operator', () => {
      jsepEval.aliasForUnaryOp('NOT', '!');
      expect(jsepEval.evaluate('!false')).toBe(true);
    });

    test(name + ': should be able to replace jsep', () => {
      const original = jsepEval.getParser();
      expect(jsepEval.setParser('mock').getParser()).toEqual('mock');
      expect(jsepEval.restoreParser().getParser()).toEqual(original);
    });

    test(name + ': should be able to add node types', () => {
      jsepEval.addType('LITERAL', 'Literal', (node, context) => context.a);
      expect(jsepEval.evaluate('"1"', { a: 10 }))
        .toEqual(10);
    });

    test(name + ': should be able to get/delete/add node types', () => {
      const original = jsepEval.getType('LITERAL');
      jsepEval.removeType('LITERAL');
      expect(() => jsepEval.evaluate('1')).toThrow();
      jsepEval.addType('LITERAL', original.type, original.fn);
      expect(jsepEval.evaluate('1')).toEqual(1);
    });
  });

  describe('\n\t=== jsepEval.peval( (promise wrapper) ===', () => {
    test(name + ': should reject for case where evaluate throws an error', () => {
      const ctx = {
        a: {b: {c: {d: 3}}},
      };
      const exp = 'a ***';
      return expect(jsepEval.peval(exp, ctx)).rejects.toThrow();
    });

    test(name + ': should evaluate correctly (example taken from above)', () => {
      return expect(jsepEval.peval('4 === 4')).resolves.toBe(true);
    });

    test(name + ': should support pEvalTree', () => {
      const tree = jsepEval.parse('1 + 1');
      return expect(jsepEval.pevalTree(tree))
        .resolves.toEqual(2);
    });
  });
});
