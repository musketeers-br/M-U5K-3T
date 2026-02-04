
const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.PROD)
  ? "/mu5k3t/api"
  : "/mu5k3t/api";

const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;

// --- DYNAMIC OBJECT WRAPPER ---
export class DynamicObjectWrapper {
  constructor(data = {}) {
    this.data = data;
  }
  _Get(key) {
    const val = this.data[key];
    if (val === undefined || val === null) return "";
    if (typeof val === 'object' && !Array.isArray(val) && !(val instanceof DynamicObjectWrapper)) {
      return new DynamicObjectWrapper(val);
    }
    return val;
  }
  _Set(key, value) {
    const val = (value instanceof DynamicObjectWrapper) ? value.data : value;
    this.data[key] = val;
  }
  _ToJSON() { return JSON.stringify(this.data); }
}

// --- RUNTIME LIBRARY ---
const lib = {
  Piece: (str, delim, index = 1) => {
    if (!str) return "";
    const parts = String(str).split(delim);
    if (index < 1 || index > parts.length) return "";
    return parts[index - 1];
  },
  Length: (str) => (str ? String(str).length : 0),
  Get: (val, defaultVal) => ((val !== undefined && val !== null && val !== "") ? val : defaultVal)
};

// --- LEXER DEFINITIONS ---
const TOKEN_TYPES = {
  COMMAND: 'COMMAND',
  STRING: 'STRING',
  OPERATOR: 'OPERATOR',
  IDENTIFIER: 'IDENTIFIER',
  LBRACE: 'LBRACE', RBRACE: 'RBRACE',
  LPAREN: 'LPAREN', RPAREN: 'RPAREN',
  COMMA: 'COMMA', COLON: 'COLON',
  NUMBER: 'NUMBER', NEWLINE: 'NEWLINE', EOF: 'EOF'
};

// --- LEXER CLASS ---
export class Lexer {
  constructor(code) {
    this.code = code;
    this.pos = 0;
    this.tokens = [];
  }
  tokenize() {
    while (this.pos < this.code.length) {
      const char = this.code[this.pos];
      if (char === '\r') { this.pos++; continue; }
      if (char === ' ' && this.code[this.pos + 1] === ' ') {
        this.tokens.push({ type: TOKEN_TYPES.NEWLINE, value: '\n' });
        this.pos += 2; continue;
      }
      if (char === '\n') { this.tokens.push({ type: TOKEN_TYPES.NEWLINE, value: '\n' }); this.pos++; continue; }
      if ((char === '/' && this.code[this.pos + 1] === '/') || char === '#') { this.skipComment(); continue; }
      if (/\s/.test(char)) { this.pos++; continue; }
      if (char === '"') { this.readString(); continue; }
      if (/[0-9]/.test(char)) { this.readNumber(); continue; }
      if (this.handleOperators()) { continue; }
      if (/[a-zA-Z_]/.test(char)) { this.readIdentifier(); continue; }
      this.pos++;
    }
    this.tokens.push({ type: TOKEN_TYPES.EOF, value: '' });
    return this.tokens;
  }
  skipComment() { while (this.pos < this.code.length && this.code[this.pos] !== '\n') this.pos++; }
  readString() {
    let value = ''; this.pos++;
    while (this.pos < this.code.length) {
      const char = this.code[this.pos];
      if (char === '\\' && this.code[this.pos + 1] === '"') { value += '\\"'; this.pos += 2; continue; }
      if (char === '"') break;
      value += char; this.pos++;
    }
    this.pos++;
    this.tokens.push({ type: TOKEN_TYPES.STRING, value: `"${value}"` });
  }
  readNumber() {
    let value = '';
    while (this.pos < this.code.length && /[0-9.]/.test(this.code[this.pos])) { value += this.code[this.pos]; this.pos++; }
    this.tokens.push({ type: TOKEN_TYPES.NUMBER, value });
  }
  readIdentifier() {
    let value = '';
    while (this.pos < this.code.length && /[a-zA-Z0-9_$]/.test(this.code[this.pos])) { value += this.code[this.pos]; this.pos++; }
    const lower = value.toLowerCase();
    const map = {
      's': 'set', 'set': 'set',
      'd': 'do', 'do': 'do',
      'w': 'write', 'write': 'write',
      'i': 'if', 'if': 'if',
      'e': 'else', 'else': 'else',
      'ei': 'elseif', 'elseif': 'elseif',
      'f': 'for', 'for': 'for',
      'while': 'while',
      'q': 'quit', 'quit': 'quit', 'return': 'return'
    };
    if (map[lower]) this.tokens.push({ type: TOKEN_TYPES.COMMAND, value: map[lower], original: value });
    else this.tokens.push({ type: TOKEN_TYPES.IDENTIFIER, value });
  }
  handleOperators() {
    const char = this.code[this.pos];
    const next = this.code[this.pos + 1];
    if (char === '{') { this.tokens.push({ type: TOKEN_TYPES.LBRACE, value: '{' }); this.pos++; return true; }
    if (char === '}') { this.tokens.push({ type: TOKEN_TYPES.RBRACE, value: '}' }); this.pos++; return true; }
    if (char === '(') { this.tokens.push({ type: TOKEN_TYPES.LPAREN, value: '(' }); this.pos++; return true; }
    if (char === ')') { this.tokens.push({ type: TOKEN_TYPES.RPAREN, value: ')' }); this.pos++; return true; }
    if (char === ',') { this.tokens.push({ type: TOKEN_TYPES.COMMA, value: ',' }); this.pos++; return true; }
    if (char === ':') { this.tokens.push({ type: TOKEN_TYPES.COLON, value: ':' }); this.pos++; return true; }
    if (char === '=') {
      if (next === '=') { this.tokens.push({ type: TOKEN_TYPES.OPERATOR, value: '==' }); this.pos += 2; }
      else { this.tokens.push({ type: TOKEN_TYPES.OPERATOR, value: '=' }); this.pos++; }
      return true;
    }
    if (['.', '%'].includes(char)) { this.tokens.push({ type: TOKEN_TYPES.OPERATOR, value: char }); this.pos++; return true; }
    if (char === '_') { this.tokens.push({ type: TOKEN_TYPES.OPERATOR, value: '+' }); this.pos++; return true; }
    if (['<', '>', '!'].includes(char)) {
      if (next === '=') { this.tokens.push({ type: TOKEN_TYPES.OPERATOR, value: char + '=' }); this.pos += 2; }
      else { this.tokens.push({ type: TOKEN_TYPES.OPERATOR, value: char }); this.pos++; }
      return true;
    }
    if (['+', '-', '*', '/'].includes(char)) {
      this.tokens.push({ type: TOKEN_TYPES.OPERATOR, value: char });
      this.pos++;
      return true;
    }
    return false;
  }
}

// --- VALIDATOR CLASS ---
export class Validator {
  constructor(tokens) {
    this.tokens = tokens;
  }
  validate() {
    let braceCount = 0;
    for (const t of this.tokens) {
      if (t.type === TOKEN_TYPES.LBRACE) braceCount++;
      if (t.type === TOKEN_TYPES.RBRACE) braceCount--;
    }
    if (braceCount !== 0) throw new Error(`Syntax Error: Unbalanced braces. Net count: ${braceCount}`);
    return true;
  }
}

// --- PARSER CLASS ---
export class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.output = [];
    this.insideClassMethod = false;
    // SCOPE AWARENESS: Track known locals
    this.locals = new Set(['memory', 'rover', 'json']);
  }

  parse() {
    this.output = [];
    if (this.tokens.length > 0 && this.tokens[0].value === 'ClassMethod') {
      this.insideClassMethod = true;
      while (this.pos < this.tokens.length && this.tokens[this.pos].type !== TOKEN_TYPES.LBRACE) this.pos++;
      this.pos++;
    }
    while (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];
      if (token.type === TOKEN_TYPES.EOF) break;
      if (this.insideClassMethod && token.type === TOKEN_TYPES.RBRACE) {
        let nextIdx = this.pos + 1;
        while (nextIdx < this.tokens.length && this.tokens[nextIdx].type === TOKEN_TYPES.NEWLINE) nextIdx++;
        if (nextIdx >= this.tokens.length || this.tokens[nextIdx].type === TOKEN_TYPES.EOF) { this.pos++; continue; }
      }
      if (token.type === TOKEN_TYPES.NEWLINE) { this.pos++; continue; }
      this.parseStatement();
    }
    return this.output.join('\n');
  }

  parseStatement() {
    const token = this.tokens[this.pos];
    if (token.type === TOKEN_TYPES.COMMAND) this.handleCommand(token.value);
    else if (token.type === TOKEN_TYPES.RBRACE) { this.output.push('}'); this.pos++; }
    else this.pos++;
  }

  handleCommand(cmd) {
    this.pos++;
    switch (cmd) {
      case 'set': this.parseSet(); break;
      case 'do': this.parseDo(); break;
      case 'if': this.parseIf(); break;
      case 'elseif': this.parseElseIf(); break;
      case 'else': this.parseElse(); break;
      case 'for': this.parseForLoop(); break;
      case 'while': this.parseWhile(); break;
      case 'write': this.parseWrite(); break;
      case 'quit': case 'return': this.output.push('return;'); break;
    }
  }

  parseSet() {
    const name = this.parseExpression(true);
    // Register local variable if simpler identifier
    const simpleName = name.split(/[.([ ]/)[0];
    if (simpleName && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(simpleName)) {
      this.locals.add(simpleName);
    }

    if (this.check(TOKEN_TYPES.OPERATOR, '=')) {
      this.pos++;
      const val = this.parseExpression(false);
      this.output.push(`${name} = ${val};`);
    }
  }

  parseDo() {
    const expr = this.parseExpression(false);
    // Scope Awareness Check
    const rootVar = expr.split(/[.(]/)[0];
    const isAsync = expr.includes('(') || expr.includes('._');

    let line = "";
    // If it starts with a known local, do not prepend context
    if (this.locals.has(rootVar) ||
      rootVar === 'context' ||
      rootVar === 'memory' ||
      rootVar === 'lib' ||
      rootVar === 'roverApi' ||
      rootVar.startsWith('lib.') ||
      rootVar.startsWith('roverApi.')) {
      line = expr;
    } else {
      // Assume implicit context method
      line = `context.${expr}`;
    }

    if (isAsync) this.output.push(`await ${line};`);
    else this.output.push(`${line};`); // fallback
  }

  parseWrite() {
    let args = [];
    while (this.pos < this.tokens.length) {
      if (this.check(TOKEN_TYPES.NEWLINE) || this.check(TOKEN_TYPES.COMMAND) || this.check(TOKEN_TYPES.RBRACE)) break;
      args.push(this.parseExpression(false));
      if (this.check(TOKEN_TYPES.COMMA)) this.pos++;
    }
    this.output.push(`roverApi.Write(${args.join(' + " " + ')});`);
  }

  parseIf() { const c = this.parseCondition(); this.consume(TOKEN_TYPES.LBRACE); this.output.push(`if (${c}) {`); }
  parseElseIf() { const c = this.parseCondition(); this.consume(TOKEN_TYPES.LBRACE); this.output.push(`else if (${c}) {`); }
  parseElse() { this.consume(TOKEN_TYPES.LBRACE); this.output.push(`else {`); }
  parseWhile() { const c = this.parseCondition(); this.consume(TOKEN_TYPES.LBRACE); this.output.push(`while (${c}) {`); }

  parseForLoop() {
    const varNameToken = this.tokens[this.pos];
    const varName = varNameToken.original || varNameToken.value;
    this.locals.add(varName); // Register loop var
    this.pos++;

    this.consume(TOKEN_TYPES.OPERATOR, '=');
    const start = this.tokens[this.pos].value; this.pos++;
    this.consume(TOKEN_TYPES.COLON);
    let step = "1", end = "";
    const nextVal = this.tokens[this.pos].value; this.pos++;
    if (this.check(TOKEN_TYPES.COLON)) { step = nextVal; this.pos++; end = this.tokens[this.pos].value; this.pos++; }
    else { end = nextVal; }
    this.consume(TOKEN_TYPES.LBRACE);
    this.output.push(`for (let ${varName} = ${start}; ${varName} <= ${end}; ${varName} += ${step}) {`);
  }

  parseCondition() {
    let condition = "";
    while (this.pos < this.tokens.length) {
      const t = this.tokens[this.pos];
      if (t.type === TOKEN_TYPES.LBRACE) break;
      if (t.type === TOKEN_TYPES.NEWLINE) break;
      if (t.value === '=') { condition += ' == '; this.pos++; }
      else condition += this.parseExpressionToken();
    }
    return condition;
  }

  parseExpression(isLeft = false) {
    if (this.check(TOKEN_TYPES.LBRACE)) return this.parseJsonLiteral();
    let res = "";
    while (this.pos < this.tokens.length) {
      const t = this.tokens[this.pos];
      if (t.type === TOKEN_TYPES.NEWLINE || t.type === TOKEN_TYPES.RBRACE || t.type === TOKEN_TYPES.COMMA || t.type === TOKEN_TYPES.COLON) break;
      if (t.type === TOKEN_TYPES.LBRACE) break;

      if (t.type === TOKEN_TYPES.COMMAND) {
        let val = t.original || t.value; this.pos++;
        val += this.parseChain();
        res += val;
      }
      else if (t.type === TOKEN_TYPES.IDENTIFIER) {
        if (t.value.startsWith('$')) {
          const funcName = t.value.substring(1); this.pos++;
          const args = this.parseParenGroup();
          res += `lib.${funcName}${args}`;
        } else {
          let val = t.value; this.pos++;
          val += this.parseChain();
          res += val;
        }
      } else if (t.type === TOKEN_TYPES.LPAREN) {
        res += this.parseParenGroup();
      } else if (t.type === TOKEN_TYPES.OPERATOR) {
        if (t.value === '+') res += ' + ';
        else if (t.value === '=') { if (isLeft) break; res += ' == '; }
        else res += " " + t.value + " "; // OPERATOR FIX: Add spaces around operators
        this.pos++;
      } else {
        res += t.value; this.pos++;
      }
    }
    return res;
  }

  parseExpressionToken() {
    const t = this.tokens[this.pos];
    if (t.type === TOKEN_TYPES.LBRACE) return this.parseJsonLiteral();
    if (t.type === TOKEN_TYPES.IDENTIFIER || t.type === TOKEN_TYPES.COMMAND) {
      let val = t.original || t.value; this.pos++;
      if (val.startsWith('$')) {
        val = `lib.${val.substring(1)}`;
        if (this.check(TOKEN_TYPES.LPAREN)) val += this.parseParenGroup();
        return val;
      }
      val += this.parseChain();
      return val;
    }
    if (t.type === TOKEN_TYPES.LPAREN) return this.parseParenGroup();
    this.pos++; return t.value;
  }

  parseChain() {
    let chain = "";
    while (this.pos < this.tokens.length) {
      if (this.check(TOKEN_TYPES.OPERATOR, '.') || this.check(TOKEN_TYPES.OPERATOR, '%')) {
        const op = this.tokens[this.pos].value; this.pos++;
        let isUnderscore = (op === '%');
        if (op === '.' && this.check(TOKEN_TYPES.OPERATOR, '%')) { isUnderscore = true; this.pos++; }

        if (this.pos >= this.tokens.length) break;
        const t = this.tokens[this.pos];
        if (t.type !== TOKEN_TYPES.IDENTIFIER && t.type !== TOKEN_TYPES.COMMAND) break;

        const method = t.original || t.value; this.pos++;
        chain += isUnderscore ? `._${method}` : `.${method}`;

        if (this.check(TOKEN_TYPES.LPAREN)) chain += this.parseParenGroup();
      } else {
        break;
      }
    }
    return chain;
  }

  parseParenGroup() {
    let res = "("; this.consume(TOKEN_TYPES.LPAREN);
    while (!this.check(TOKEN_TYPES.RPAREN) && !this.check(TOKEN_TYPES.EOF)) {
      if (this.check(TOKEN_TYPES.LBRACE)) res += this.parseJsonLiteral();
      else {
        const t = this.tokens[this.pos];
        if (t.value === '=') res += '==';
        else if (t.type === TOKEN_TYPES.IDENTIFIER || t.type === TOKEN_TYPES.COMMAND) {
          let val = t.original || t.value; this.pos++; val += this.parseChain(); res += val; continue;
        }
        else res += t.value; this.pos++;
      }
    }
    this.consume(TOKEN_TYPES.RPAREN); res += ")"; return res;
  }

  parseJsonLiteral() {
    let json = "{"; this.consume(TOKEN_TYPES.LBRACE);
    while (!this.check(TOKEN_TYPES.RBRACE) && !this.check(TOKEN_TYPES.EOF)) {
      if (this.check(TOKEN_TYPES.COMMA)) { json += ","; this.pos++; }
      else if (this.check(TOKEN_TYPES.COLON)) { json += ":"; this.pos++; }
      else if (this.check(TOKEN_TYPES.LPAREN)) json += this.parseParenGroup();
      else if (this.check(TOKEN_TYPES.STRING)) { json += this.tokens[this.pos].value; this.pos++; }
      else if (this.check(TOKEN_TYPES.NUMBER)) { json += this.tokens[this.pos].value; this.pos++; }
      else { json += this.tokens[this.pos].value; this.pos++; }
    }
    this.consume(TOKEN_TYPES.RBRACE); json += "}"; return json;
  }

  check(type, val) {
    if (this.pos >= this.tokens.length) return false;
    const t = this.tokens[this.pos];
    if (t.type !== type) return false;
    if (val && t.value !== val) return false;
    return true;
  }
  consume(type, val) { if (this.check(type, val)) this.pos++; }
}

// --- SIMULATION RUNTIME ---
export const Simulation = {
  state: { rover: null, mapData: null, running: false, fuel: 100, health: 100, score: 0, steps: 0, interval: null, gridSize: 25, memory: {}, grid: [], missionId: 'M1' },
  init(mapData, roverMesh, scene, onHudUpdate, sensorMeshes = {}) {
    console.log("⚙️ Simulation Engine v4.0 (Scope-Aware) Initializing...");
    this.state.mapData = mapData; this.state.rover = roverMesh; this.state.updateHUD = onHudUpdate; this.state.sensorMeshes = sensorMeshes;
    this.state.fuel = 100; this.state.health = 100; this.state.score = 0; this.state.steps = 0; this.state.running = false; this.state.memory = {};
    this.state.gridSize = mapData.gridSize || 25;
    const offset = (this.state.gridSize * 1.2) / 2 - 0.6;
    this.state.gridToWorld = (x, z) => ({ x: (x * 1.2) - offset, z: (z * 1.2) - offset });
    const roverStart = mapData.roverStart || { x: 0, z: 0 };
    this.state.memory.x = roverStart.x; this.state.memory.z = roverStart.z; this.state.memory.direction = 'north';
    if (this.state.rover) { const wp = this.state.gridToWorld(roverStart.x, roverStart.z); this.state.rover.position.set(wp.x, 0.2, wp.z); this.state.rover.rotation.set(0, 0, 0); }
    if (this.state.updateHUD) this.state.updateHUD({ fuel: 100, health: 100, score: 0, steps: 0, status: "READY" });
  },
  stop() { if (this.state.interval) clearInterval(this.state.interval); },

  // RUNCODE UPGRADE
  async runCode(userCode) {
    if (!this.state.rover) { console.error("Rover not initialized!"); return; }
    try {
      const tokens = new Lexer(userCode).tokenize();

      // 1. Validation Phase
      new Validator(tokens).validate();

      // 2. Transpilation Phase
      const parser = new Parser(tokens);
      const jsCode = parser.parse();
      console.log("📜 JS Output:\n", jsCode);

      // 3. Execution Phase
      const rawContextData = { rover: { sensors: { front: "CLEAR" } }, memory: this.state.memory, output: { action: "WAIT", param: "" } };
      const contextWrapper = new DynamicObjectWrapper(rawContextData);
      contextWrapper.Move = () => this.moveRover(); contextWrapper.Turn = (d) => this.turnRover(d); contextWrapper.Collect = () => this.collectMineral(); contextWrapper.Scan = () => this.scanSensors(); contextWrapper.Set = (k, v) => contextWrapper._Set(k, v);
      const roverApi = { Write: (...args) => console.log("📡", ...args) };

      // Inject MEMORY object directly for scope-aware variables
      const memoryWrapper = new DynamicObjectWrapper(this.state.memory);

      const userFunction = new AsyncFunction('context', 'roverApi', 'lib', 'memory', jsCode);

      this.state.running = true; this.state.steps = 0;
      const executeStep = async () => {
        if (!this.state.running) return;
        try {
          rawContextData.rover.sensors = this.scanSensors(true);
          // Pass memoryWrapper explicitly
          await userFunction(contextWrapper, roverApi, lib, memoryWrapper);

          // Sync back? memoryWrapper shares ref to state.memory via init? No for primitive changes if wrappers are used logic might differ, 
          // but DynamicObjectWrapper updates this.data reference. 
          // this.state.memory is passed by ref to wrapper.

          this.state.steps++;
          const out = rawContextData.output;
          if (out && out.action !== "WAIT") { if (out.action === "MOVE") await this.moveRover(); if (out.action === "TURN") await this.turnRover(out.param); out.action = "WAIT"; }
          if (this.state.updateHUD) this.state.updateHUD({ fuel: this.state.fuel, health: this.state.health, score: this.state.score, steps: this.state.steps, status: `STEP ${this.state.steps}` });
        } catch (err) { console.error("Runtime Error:", err); this.stop(); }
      };
      await executeStep();
      this.state.interval = setInterval(async () => { if (this.state.running && this.state.fuel > 0 && this.state.health > 0) await executeStep(); else this.stop(); }, 500);
    } catch (e) {
      console.error("Simulation Error:", e);
      alert("Error: " + e.message);
    }
  },

  async moveRover() { if (!this.state.running || this.state.fuel <= 0) return false; const dir = this.state.memory.direction || 'north'; let nx = this.state.memory.x, nz = this.state.memory.z; if (dir === 'north') nz--; if (dir === 'south') nz++; if (dir === 'east') nx++; if (dir === 'west') nx--; if (nx < 0 || nx >= this.state.gridSize || nz < 0 || nz >= this.state.gridSize) return false; if (this.state.mapData.obstacles && this.state.mapData.obstacles.some(o => o.x === nx && o.z === nz)) { this.state.health -= 10; return false; } this.state.memory.x = nx; this.state.memory.z = nz; this.state.fuel -= 1; if (this.state.rover) { const wp = this.state.gridToWorld(nx, nz); this.state.rover.position.set(wp.x, 0.2, wp.z); } return true; },
  async turnRover(d) { if (!this.state.running) return; this.state.memory.direction = d.toLowerCase(); if (this.state.rover) { const r = { north: 0, east: Math.PI / 2, south: Math.PI, west: -Math.PI / 2 }; this.state.rover.rotation.y = r[d.toLowerCase()] || 0; } },
  collectMineral() { const x = this.state.memory.x, z = this.state.memory.z; const idx = this.state.mapData.minerals.findIndex(m => m.x === x && m.z === z); if (idx >= 0) { this.state.score += 50; this.state.mapData.minerals.splice(idx, 1); console.log("Mineral Collected"); } },
  scanSensors() { return { front: "CLEAR" }; },

  async runTests() {
    console.log("🧪 Running v4.0 Transpiler Tests...");
    const tests = [
      { name: "Legacy Abbrev", code: 's x=1', expect: 'x = 1;' },
      { name: "Scope Local", code: 'Do memory.%Set("x",1)', expect: 'await memory._Set("x",1);' },
      { name: "Double Context Fix", code: 'Do context.%Set("x",1)', expect: 'await context._Set("x",1);' },
      { name: "Operator Space", code: 's x=a+b', expect: 'x = a + b;' },
      { name: "JSON Param", code: 'd f({"a":1})', expect: 'await context.f({"a":1});' },
      { name: "Chain", code: 's v=o.%Get("k").%Get("v")', expect: 'v = o._Get("k")._Get("v");' }
    ];
    let passed = 0;
    for (const t of tests) {
      try {
        const tokens = new Lexer(t.code).tokenize();
        new Validator(tokens).validate();
        const parser = new Parser(tokens);
        const out = parser.parse().replace(/\s+/g, ' ').trim();
        const exp = t.expect.replace(/\s+/g, ' ');
        if (out.includes(exp)) { console.log(`✅ ${t.name}: PASS`); passed++; }
        else { console.error(`❌ ${t.name}: FAIL. Got: ${out}`); }
      } catch (e) { console.error(`❌ ${t.name}: EXC: ${e.message}`); }
    }
    return passed === tests.length;
  }
};
export const MISSIONS = { 'M1': { name: 'First Cut', briefing: 'Collect 5 minerals.', objectives: { minMinerals: 5 } } };
setTimeout(() => Simulation.runTests(), 100);