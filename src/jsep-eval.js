const get = require('lodash/get');
const set = require('lodash/set');
const has = require('lodash/has');
const lastIndexOf = require('lodash/lastIndexOf');
const map = require('lodash/map');
const includes = require('lodash/includes');
const jsep = require('jsep');
const assert = require('assert');

module.exports = class JsepEval {
  constructor() {
    this.jsep = jsep;

    // defaults
    this.operators = {
      binary: {
        '===': (a, b) => (a === b),
        '!==': (a, b) => (a !== b),
        '==': (a, b) => (a == b), // eslint-disable-line
        '!=': (a, b) => (a != b), // eslint-disable-line
        '>': (a, b) => (a > b),
        '<': (a, b) => (a < b),
        '>=': (a, b) => (a >= b),
        '<=': (a, b) => (a <= b),
        '+': (a, b) => (a + b),
        '-': (a, b) => (a - b),
        '*': (a, b) => (a * b),
        '/': (a, b) => (a / b),
        '%': (a, b) => (a % b),
        // '**': (a, b) => (a ** b),
        '&': (a, b) => (a & b),
        '|': (a, b) => (a | b),
        '^': (a, b) => (a ^ b),
        '<<': (a, b) => (a << b),
        '>>': (a, b) => (a >> b),
        '>>>': (a, b) => (a >>> b),
        '||': (a, b) => (a || b),
        '&&': (a, b) => (a && b),
      },
      unary: {
        '!': a => !a,
        '~': a => ~a, // bitwise NOT
        '+': a => +a, // unary plus
        '-': a => -a, // unary negation
        // '++': a => ++a, // increment
        // '--': a => --a, // decrement
      },
    };

    this.types = {
      LITERAL: 'Literal',
      UNARY: 'UnaryExpression',
      BINARY: 'BinaryExpression',
      LOGICAL: 'LogicalExpression',
      CONDITIONAL: 'ConditionalExpression',
      MEMBER: 'MemberExpression',
      IDENTIFIER: 'Identifier',
      THIS: 'ThisExpression',
      CALL: 'CallExpression',
      ARROW: 'ArrowFunctionExpression',
      ARRAY: 'ArrayExpression',
      COMPOUND: 'Compound',
    };
  }

  // customization methods

  addBinaryOp(op, fn) {
    this.operators.binary[op] = fn;
    return this;
  }

  aliasForBinaryOp(alias, op) {
    this.addBinaryOp(alias, this.operators.binary[op]);
    return this;
  }

  removeBinaryOp(op) {
    delete this.operators.binary[op];
    return this;
  }

  addUnaryOp(op, fn) {
    this.operators.unary[op] = fn;
    return this;
  }

  aliasForUnaryOp(alias, op) {
    this.addUnaryOp(alias, this.operators.unary[op]);
    return this;
  }

  removeUnaryOp(op) {
    delete this.operators.unary[op];
    return this;
  }

  getParser() {
    return this.jsep;
  }

  setParser(jsepInstance) {
    this.jsep = jsepInstance;
    return this;
  }

  restoreParser() {
    this.jsep = jsep;
    return this;
  }

  addType(type, nodeType) {
    this.types[type] = nodeType;
    return this;
  }

  removeType(type) {
    delete this.types[type];
    return this;
  }

  // /customization methods

  undefOperator() {
    return undefined;
  }

  getParameterPath(node, context) {
    assert(node, 'Node missing');
    const type = node.type;
    assert(includes(this.types, type), 'invalid node type');
    assert(includes([this.types.MEMBER, this.types.IDENTIFIER], type), 'Invalid parameter path node type: ', type);
    // the easy case: 'IDENTIFIER's
    if (type === this.types.IDENTIFIER) {
      return node.name;
    }
    // Otherwise it's a MEMBER expression
    // EXAMPLES:  a[b] (computed)
    //            a.b (not computed)
    const computed = node.computed;
    const object = node.object;
    // object is either 'IDENTIFIER', 'MEMBER', or 'THIS'
    assert(includes([this.types.MEMBER, this.types.IDENTIFIER, this.types.THIS], object.type), 'Invalid object type');

    const objectPath = object.type === this.types.THIS
      ? ''
      : node.name || this.getParameterPath(object, context);
    const propertyPath = this.propertyPath(node, context);

    return computed
           ? (objectPath + '[' + propertyPath + ']')
           : (objectPath ? objectPath + '.': '') + propertyPath;
  }

  propertyPath(node, context) {
    const property = node.property;
    assert(property, 'Member expression property is missing');
    if (node.computed) {
      // if computed -> evaluate anew
      return this.evaluateExpressionNode(property, context);
    } else {
      assert(includes([this.types.MEMBER, this.types.IDENTIFIER], property.type), 'Invalid object type');
      return property.name || this.getParameterPath(property, context);
    }
  }

  evaluateExpressionNode(node, context) {
    assert(node, 'Node missing');
    assert(includes(this.types, node.type), 'invalid node type');
    const result = (() => {
      switch (node.type) {
        case this.types.LITERAL: {
          return node.value;
        }
        case this.types.THIS: {
          return context;
        }
        case this.types.COMPOUND: {
          const expressions = map(node.body, el => this.evaluateExpressionNode(el, context));
          return expressions.pop();
        }
        case this.types.ARRAY: {
          const elements = map(node.elements, el => this.evaluateExpressionNode(el, context));
          return elements;
        }
        case this.types.UNARY: {
          const operator = this.operators.unary[node.operator] || this.undefOperator;
          assert(includes(this.operators.unary, operator), 'Invalid unary operator');
          const argument = this.evaluateExpressionNode(node.argument, context);
          return operator(argument);
        }
        case this.types.LOGICAL: // !!! fall-through to BINARY !!! //
        case this.types.BINARY: {
          const operator = this.operators.binary[node.operator] || this.undefOperator;
          assert(includes(this.operators.binary, operator), 'Invalid binary operator');
          const left = this.evaluateExpressionNode(node.left, context);
          const right = this.evaluateExpressionNode(node.right, context);
          return operator(left, right);
        }
        case this.types.CONDITIONAL: {
          const test = this.evaluateExpressionNode(node.test, context);
          const consequent = this.evaluateExpressionNode(node.consequent, context);
          const alternate = this.evaluateExpressionNode(node.alternate, context);
          return test ? consequent : alternate;
        }
        case this.types.CALL : {
          assert(includes([this.types.MEMBER, this.types.IDENTIFIER, this.types.THIS], node.callee.type), 'Invalid function callee type');
          const callee = this.evaluateExpressionNode(node.callee, context);
          if (!callee) {
            throw new Error(`could not evaluate '${get(node, 'callee.name', get(node, 'callee.property.name'))}'`);
          }
          const args = map(node.arguments, arg => this.evaluateExpressionNode(arg, context));
          return callee.apply(null, args);
        }
        case this.types.ARROW: {
          const arrowContext = { ...context };
          return (...arrowArgs) => {
            (node.params || []).forEach((n, i) => set(arrowContext, n.name, arrowArgs[i]));
            return this.evaluateExpressionNode(node.body, arrowContext);
          }
        }
        case this.types.IDENTIFIER: // !!! fall-through to MEMBER !!! //
        case this.types.MEMBER: {
          let path;
          let memberContext;
          const chaining = [this.types.ARROW, this.types.CALL, this.types.ARRAY].includes(get(node, 'object.type'));
          if (chaining)  {
            memberContext = this.evaluateExpressionNode(node.object, context);
            path = this.propertyPath(node, memberContext);
          } else {
            memberContext = context;
            path = this.getParameterPath(node, context);
          }

          let found = get(memberContext, path);
          if (found === undefined) {
            return undefined;
          }
          if (typeof found === 'function') {
            if (chaining) {
              found = found.bind(memberContext);
            } else if (!has(memberContext, path)) {
              const seg = lastIndexOf(path, '.');
              if (seg > 0) {
                found = found.bind(get(memberContext, path.substr(0, seg)));
              }
            }
          }
          return found;
        }
      }
    })();
    node.isEvaluated = true;
    node.result = result;
    return result;
  }

  // evaluation methods

  evaluate(expression, context) {
    const tree = this.parse(expression);
    return this.evaluateTree(tree, context);
  }

  peval(expression, context) {
    return Promise.resolve().then(() => this.evaluate(expression, context));
  }

  evaluateTree(tree, context) {
    return this.evaluateExpressionNode(tree, context);
  };

  pevalTree(tree, context) {
    return Promise.resolve().then(() => this.evaluateTree(tree, context));
  }

  /**
   * @param {string} expression
   * @returns {*}
   * @throws Error on invalid expression
   */
  parse(expression) {
    return this.jsep(expression);
  }
};
