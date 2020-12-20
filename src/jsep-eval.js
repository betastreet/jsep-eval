const get = require('lodash/get');
const set = require('lodash/set');
const has = require('lodash/has');
const lastIndexOf = require('lodash/lastIndexOf');
const map = require('lodash/map');
const includes = require('lodash/includes');
const find = require('lodash/find');
const jsep = require('jsep');
const assert = require('assert');

module.exports = class JsepEval {
  static #_instance;

  static get instance() {
    return this.#_instance || new JsepEval();
  }

  constructor() {
    JsepEval.#_instance = this;
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
      LITERAL: { type: 'Literal', fn: this.evaluateLiteralNode.bind(this) },
      UNARY: { type: 'UnaryExpression', fn: this.evaluateUnaryNode.bind(this) },
      BINARY: { type: 'BinaryExpression', fn: this.evaluateBinaryNode.bind(this) },
      LOGICAL: { type: 'LogicalExpression', fn: this.evaluateBinaryNode.bind(this) },
      CONDITIONAL: { type: 'ConditionalExpression', fn: this.evaluateConditionalNode.bind(this) },
      MEMBER: { type: 'MemberExpression', fn: this.evaluateMemberNode.bind(this) },
      IDENTIFIER: { type: 'Identifier', fn: this.evaluateMemberNode.bind(this) },
      THIS: { type: 'ThisExpression', fn: this.evaluateThisNode.bind(this) },
      CALL: { type: 'CallExpression', fn: this.evaluateCallNode.bind(this) },
      ARROW: { type: 'ArrowFunctionExpression', fn: this.evaluateArrowNode.bind(this) },
      ARRAY: { type: 'ArrayExpression', fn: this.evaluateArrayNode.bind(this) },
      COMPOUND: { type: 'Compound', fn: this.evaluateCompoundNode.bind(this) },
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

  addType(type, nodeType, fn) {
    this.types[type] = { type: nodeType, fn };
    return this;
  }

  removeType(type) {
    delete this.types[type];
    return this;
  }

  getType(type) {
    return this.types[type];
  }
  // /customization methods

  undefOperator() {
    return undefined;
  }

  getParameterPath(node, context) {
    assert(node, 'Node missing');
    const type = node.type;
    assert(includes([this.types.MEMBER.type, this.types.IDENTIFIER.type], type), 'Invalid parameter path node type: ', type);
    // the easy case: 'IDENTIFIER's
    if (type === this.types.IDENTIFIER.type) {
      return node.name;
    }
    // Otherwise it's a MEMBER expression
    // EXAMPLES:  a[b] (computed)
    //            a.b (not computed)
    const computed = node.computed;
    const object = node.object;
    // object is either 'IDENTIFIER', 'MEMBER', or 'THIS'
    assert(includes([this.types.MEMBER.type, this.types.IDENTIFIER.type, this.types.THIS.type], object.type), 'Invalid object type');

    const objectPath = object.type === this.types.THIS.type
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
      assert(includes([this.types.MEMBER.type, this.types.IDENTIFIER.type], property.type), 'Invalid object type');
      return property.name || this.getParameterPath(property, context);
    }
  }

  evaluateExpressionNode(node, context) {
    assert(node, 'Node missing');
    const nodeType = find(this.types, { type: node.type });
    assert(nodeType && nodeType.fn, 'invalid node type');

    node.result = nodeType.fn(node, context);
    node.isEvaluated = true;
    return node.result;
  }

  evaluateLiteralNode(node) {
    return node.value;
  }

  evaluateThisNode(node, context) {
    return context;
  }

  evaluateCompoundNode(node, context) {
    const expressions = map(node.body, el => this.evaluateExpressionNode(el, context));
    return expressions.pop();
  }

  evaluateArrayNode(node, context) {
    const elements = map(node.elements, el => this.evaluateExpressionNode(el, context));
    return elements;
  }

  evaluateUnaryNode(node, context) {
    const operator = this.operators.unary[node.operator] || this.undefOperator;
    assert(includes(this.operators.unary, operator), 'Invalid unary operator');
    const argument = this.evaluateExpressionNode(node.argument, context);
    return operator(argument);
  }

  evaluateBinaryNode(node, context) {
    const operator = this.operators.binary[node.operator] || this.undefOperator;
    assert(includes(this.operators.binary, operator), 'Invalid binary operator');
    const left = this.evaluateExpressionNode(node.left, context);
    if ((operator === this.operators.binary['&&'] && !left)
      || (operator === this.operators.binary['||'] && left)) {
      return left;
    }
    const right = this.evaluateExpressionNode(node.right, context);
    return operator(left, right);
  }

  evaluateConditionalNode(node, context) {
    const test = this.evaluateExpressionNode(node.test, context);
    return test
      ? this.evaluateExpressionNode(node.consequent, context)
      : this.evaluateExpressionNode(node.alternate, context);
  }

  evaluateCallNode(node, context) {
    assert(includes([this.types.MEMBER.type, this.types.IDENTIFIER.type, this.types.THIS.type], node.callee.type), 'Invalid function callee type');
    const callee = this.evaluateExpressionNode(node.callee, context);
    if (!callee) {
      throw new Error(`could not evaluate '${get(node, 'callee.name', get(node, 'callee.property.name'))}'`);
    }
    const args = map(node.arguments, arg => this.evaluateExpressionNode(arg, context));
    return callee.apply(null, args);
  }

  evaluateArrowNode(node, context) {
    const arrowContext = { ...context };
    return (...arrowArgs) => {
      (node.params || []).forEach((n, i) => set(arrowContext, n.name, arrowArgs[i]));
      return this.evaluateExpressionNode(node.body, arrowContext);
    }
  }

  evaluateMemberNode(node, context) {
    let path;
    let memberContext;
    const chaining = [this.types.ARROW.type, this.types.CALL.type, this.types.ARRAY.type].includes(get(node, 'object.type'));
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
