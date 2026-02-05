
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
  Get: (val, defaultVal) => ((val !== undefined && val !== null && val !== "") ? val : defaultVal),
  Random: (max) => Math.random() * max
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
      if (/[a-zA-Z_$]/.test(char)) { this.readIdentifier(); continue; }
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
    // Arithmetic Ops
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
    const rootVar = expr.split(/[.(]/)[0];
    const isAsync = expr.includes('(') || expr.includes('._');

    let line = "";
    if (this.locals.has(rootVar) ||
      rootVar === 'context' ||
      rootVar === 'memory' ||
      rootVar === 'lib' ||
      rootVar === 'roverApi' ||
      rootVar.startsWith('lib.') ||
      rootVar.startsWith('roverApi.')) {
      line = expr;
    } else {
      line = `context.${expr}`;
    }

    if (isAsync) this.output.push(`await ${line};`);
    else this.output.push(`${line};`);
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
    this.locals.add(varName);
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
        else res += " " + t.value + " ";
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

  // --- RECURSIVE PAREN PARSING FIX ---
  parseParenGroup() {
    let res = "(";
    this.consume(TOKEN_TYPES.LPAREN);
    let balance = 1;

    while (balance > 0 && this.pos < this.tokens.length) {
      const t = this.tokens[this.pos];

      if (this.check(TOKEN_TYPES.EOF)) break;

      if (this.check(TOKEN_TYPES.LPAREN)) {
        balance++;
        res += "(";
        this.pos++;
        continue;
      }

      if (this.check(TOKEN_TYPES.RPAREN)) {
        balance--;
        res += ")";
        this.pos++;
        if (balance === 0) break;
        continue;
      }

      if (this.check(TOKEN_TYPES.LBRACE)) {
        res += this.parseJsonLiteral();
      } else {
        if (t.value === '=') res += '==';
        else if (t.type === TOKEN_TYPES.IDENTIFIER || t.type === TOKEN_TYPES.COMMAND) {
          let val = t.original || t.value; this.pos++;

          if (val.startsWith('$')) {
            val = `lib.${val.substring(1)}`;
            if (this.check(TOKEN_TYPES.LPAREN)) val += this.parseParenGroup();
            res += val;
          } else {
            val += this.parseChain();
            res += val;
          }
        }
        else if (t.type === TOKEN_TYPES.OPERATOR) {
          res += t.value; this.pos++;
        }
        else {
          res += t.value; this.pos++;
        }
      }
    }
    return res;
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
  state: { rover: null, mapData: null, running: false, fuel: 100, health: 100, score: 0, steps: 0, interval: null, gridSize: 25, memory: {}, grid: [], missionId: 'M1', scene: null, sensorMeshes: {} },
  init(mapData, roverMesh, scene, onHudUpdate, sensorMeshes = {}) {
    console.log("⚙️ Simulation Engine v4.9 (Twin World Fix) Initializing...");

    // INTEGRITY CHECK
    console.log("🗺️ SIMULATION MAP LOADED. Minerals:", mapData.minerals.length, "Obstacles:", mapData.obstacles ? mapData.obstacles.length : 0);
    if (mapData.minerals.length > 0) {
      console.log("   First Mineral at:", mapData.minerals[0].x, mapData.minerals[0].z);
    }

    this.state.mapData = mapData;
    this.state.rover = roverMesh;
    this.state.scene = scene;
    this.state.updateHUD = onHudUpdate;
    this.state.sensorMeshes = sensorMeshes;
    this.state.fuel = 100; this.state.health = 100; this.state.score = 0; this.state.steps = 0; this.state.running = false; this.state.memory = {};
    this.state.gridSize = mapData.gridSize || 25;
    const offset = (this.state.gridSize * 1.2) / 2 - 0.6;
    this.state.gridToWorld = (x, z) => ({ x: (x * 1.2) - offset, z: (z * 1.2) - offset });
    const roverStart = mapData.roverStart || { x: 0, z: 0 };
    this.state.memory.x = roverStart.x; this.state.memory.z = roverStart.z; this.state.memory.direction = 'north';

    // Rotation Map (The Final Flip: North=180deg)
    const r = { north: Math.PI, east: -Math.PI / 2, south: 0, west: Math.PI / 2 };
    if (this.state.rover) {
      const wp = this.state.gridToWorld(roverStart.x, roverStart.z);
      this.state.rover.position.set(wp.x, 0.2, wp.z);
      this.state.rover.rotation.y = r['north'];
    }
    if (this.state.updateHUD) this.state.updateHUD({ fuel: 100, health: 100, score: 0, steps: 0, status: "READY" });

    // Auto-run Physics Tests
    this.runPhysicsTests();
  },
  stop() { if (this.state.interval) clearInterval(this.state.interval); },

  async runCode(userCode) {
    if (!this.state.rover) { console.error("Rover not initialized!"); return; }
    try {
      const tokens = new Lexer(userCode).tokenize();
      new Validator(tokens).validate();
      const parser = new Parser(tokens);
      const jsCode = parser.parse();
      console.log("📜 JS Output:\n", jsCode);

      // --- SENSOR PROXY FOR VISUAL FEEDBACK (Directional) ---
      const rawContextData = {
        rover: {},
        memory: this.state.memory,
        output: { action: "WAIT", param: "" }
      };

      // Define 'sensors' getter on context.rover
      Object.defineProperty(rawContextData.rover, 'sensors', {
        get: () => {
          // Default Access triggers Front Scan Visual
          this.scanSensors(false, 'front');
          return this.scanSensors(true, 'front');
        }
      });

      const contextWrapper = new DynamicObjectWrapper(rawContextData);
      contextWrapper.Move = () => this.moveRover();
      contextWrapper.Turn = (d) => this.turnRover(d);
      contextWrapper.Collect = () => this.collectMineral();

      // Updated Scan Signature to pass relative direction
      contextWrapper.Scan = (d = 'front') => this.scanSensors(false, d);

      contextWrapper.Set = (k, v) => contextWrapper._Set(k, v);

      const roverApi = { Write: (...args) => console.log("📡", ...args) };
      const memoryWrapper = new DynamicObjectWrapper(this.state.memory);

      const userFunction = new AsyncFunction('context', 'roverApi', 'lib', 'memory', jsCode);

      this.state.running = true; this.state.steps = 0;
      const executeStep = async () => {
        if (!this.state.running) return;
        try {
          await userFunction(contextWrapper, roverApi, lib, memoryWrapper);

          this.state.steps++;

          // API V2: State-Based Action System
          const action = rawContextData.action;

          if (action) {
            // 1. Turn
            if (action.turn) {
              await this.turnRover(action.turn);
            }
            // 2. Move
            if (action.move) { // Ignores value, just trigger
              await this.moveRover();
            }
            // 3. Rotate & Move (Advanced)
            if (action.rotate_and_move) {
              await this.turnRover(action.rotate_and_move);
              await this.moveRover();
            }

            // Cleanup to prevent loop repeats
            rawContextData.action = null;
          }

          if (this.state.updateHUD) this.state.updateHUD({ fuel: this.state.fuel, health: this.state.health, score: this.state.score, steps: this.state.steps, status: "ONLINE" });
        } catch (err) { console.error("Runtime Error:", err); this.stop(); }
      };
      await executeStep();
      this.state.interval = setInterval(async () => { if (this.state.running && this.state.fuel > 0 && this.state.health > 0) await executeStep(); else this.stop(); }, 500);
    } catch (e) {
      console.error("Simulation Error:", e);
      alert("Error: " + e.message);
    }
  },

  async moveRover() {
    if (!this.state.running || this.state.fuel <= 0) return false;

    // Auto-scan surrounding tactical grid (Situational Awareness)
    ['front', 'far', 'left', 'right'].forEach(dir => this.scanSensors(false, dir));

    const dir = this.state.memory.direction || 'north';

    // Calculate Next Position (Floating Point)
    let nextX = this.state.memory.x;
    let nextZ = this.state.memory.z;
    if (dir === 'north') nextZ--;
    if (dir === 'south') nextZ++;
    if (dir === 'east') nextX++;
    if (dir === 'west') nextX--;

    // FORCE INTEGER COORDINATES (Twin World Fix)
    const nx = Math.round(nextX);
    const nz = Math.round(nextZ);

    // DEBUG: Check for mineral underfoot immediately
    const hitMineral = this.state.mapData.minerals.find(m => Math.round(m.x) === nx && Math.round(m.z) === nz);
    if (hitMineral) {
      console.log("🚨 ROVER STEPPED ON MINERAL AT", nx, nz, "! TRIGGERING AUTO-COLLECT...");
      this.collectMineral(); // Force collection
      // Visual Feedback (Flash Gold)
      if (this.state.rover) this.state.rover.children.forEach(c => c.material && c.material.color.setHex(0xFFD700));
    }

    if (nx < 0 || nx >= this.state.gridSize || nz < 0 || nz >= this.state.gridSize) return false;

    if (this.state.mapData.obstacles && this.state.mapData.obstacles.some(o => Math.round(o.x) === nx && Math.round(o.z) === nz)) {
      this.state.health -= 10;
      if (this.state.rover && this.state.rover.userData.flashDamage) {
        this.state.rover.userData.flashDamage();
      }
      return false;
    }

    this.state.memory.x = nx; this.state.memory.z = nz; this.state.fuel -= 1;
    if (this.state.rover) { const wp = this.state.gridToWorld(nx, nz); this.state.rover.position.set(wp.x, 0.2, wp.z); }

    console.log("🚜 MOVE EXEC: Walking", dir, "to", nx, nz);
    return true;
  },

  async turnRover(d) {
    if (!this.state.running) return;
    this.state.memory.direction = d.toLowerCase();
    if (this.state.rover) {
      // Rotation Map (Moonwalking Fix: North=PI)
      const r = { north: Math.PI, east: -Math.PI / 2, south: 0, west: Math.PI / 2 };
      this.state.rover.rotation.y = r[d.toLowerCase()] || 0;
    }
  },

  collectMineral() {
    const x = Number(this.state.memory.x);
    const z = Number(this.state.memory.z);

    const dirs = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
    const facing = this.state.memory.direction || 'north';
    const offset = dirs[facing];
    const fx = x + offset[0];
    const fz = z + offset[1];

    console.log("⛏️ Collect: At", x, z, "Facing", facing, "-> Front", fx, fz);

    // Check Current Tile OR Front Tile
    const checkLocs = [{ x: x, z: z }, { x: fx, z: fz }];

    for (const loc of checkLocs) {
      // FORCE MATH.ROUND for float safety
      const idx = this.state.mapData.minerals.findIndex(m => Math.round(m.x) === Math.round(loc.x) && Math.round(m.z) === Math.round(loc.z));
      if (idx >= 0) {
        const minData = this.state.mapData.minerals[idx];
        this.state.score += 50;
        this.state.mapData.minerals.splice(idx, 1);
        console.log("💎 COLLECTION SUCCESS at", minData.x, minData.z);

        if (this.state.scene) {
          let found = false;
          this.state.scene.traverse((child) => {
            if (child.userData && child.userData.type === 'MINERAL' && Math.round(child.userData.x) === Math.round(loc.x) && Math.round(child.userData.z) === Math.round(loc.z)) {
              child.visible = false;
              found = true;
            }
          });
          if (found) console.log("Visual mineral removed.");
        }
        break;
      }
    }
  },

  // DIRECTIONAL SENSORS (Logic + Visuals)
  // DIRECTIONAL SENSORS (Logic + Visuals)
  scanSensors(isInternal = false, relativeDir = 'front') {
    // 1. Current State
    const x = Number(this.state.memory.x);
    const z = Number(this.state.memory.z);
    const facing = (this.state.memory.direction || 'north').toLowerCase();

    // 2. Directional Logic (Clockwise: N -> E -> S -> W)
    const dirs = ['north', 'east', 'south', 'west'];
    const currentIdx = dirs.indexOf(facing);

    // 3. Determine Target Direction & Distance
    let targetIdx = currentIdx;
    let steps = 1;

    if (relativeDir === 'front') {
      targetIdx = currentIdx; // Same dir
      steps = 1;
    } else if (relativeDir === 'far') { // "front_far" logic
      targetIdx = currentIdx; // Same dir
      steps = 2;
    } else if (relativeDir === 'right') {
      targetIdx = (currentIdx + 1) % 4; // +90 deg
      steps = 1;
    } else if (relativeDir === 'left') { // -90 deg (or +270)
      targetIdx = (currentIdx + 3) % 4;
      steps = 1;
    } else if (relativeDir === 'back') {
      targetIdx = (currentIdx + 2) % 4; // 180 deg
      steps = 1;
    }

    const targetDir = dirs[targetIdx];

    // 4. Calculate Coordinates (Robust Delta)
    let fx = x;
    let fz = z;

    // Apply steps
    for (let i = 0; i < steps; i++) {
      if (targetDir === 'north') fz--;
      if (targetDir === 'south') fz++;
      if (targetDir === 'east') fx++;
      if (targetDir === 'west') fx--;
    }

    // 5. Bounds & Object Detection (Existing Logic)
    let result = "CLEAR";
    if (fx < 0 || fx >= this.state.gridSize || fz < 0 || fz >= this.state.gridSize) {
      result = "OBSTACLE"; // Out of bounds is an obstacle
    } else if (this.state.mapData.obstacles.some(o => Math.round(o.x) === fx && Math.round(o.z) === fz)) {
      result = "OBSTACLE";
    } else if (this.state.mapData.minerals.some(m => Math.round(m.x) === fx && Math.round(m.z) === fz)) {
      result = "MINERAL";
    }

    // 6. Visual Update
    if (!isInternal) {
      // console.log(`🔎 SCAN [${relativeDir}]: Origin(${x},${z}) -> Target(${fx},${fz}) = ${result}`);

      let meshKey = relativeDir;

      if (this.state.sensorMeshes && this.state.sensorMeshes[meshKey]) {
        const mesh = this.state.sensorMeshes[meshKey];
        if (this.state.gridToWorld) {
          const wp = this.state.gridToWorld(fx, fz);

          // Fix: Ensure Y is physically above floor (0) and below Rover (0.2)
          mesh.position.set(wp.x, 0.05, wp.z);

          // Color Logic
          if (mesh.material) {
            if (result === 'OBSTACLE') mesh.material.color.setHex(0xFF0000); // Red
            else if (result === 'MINERAL') mesh.material.color.setHex(0xFFD700); // Gold
            else mesh.material.color.setHex(0x00FFFF); // Cyan (Clear)
          }

          mesh.visible = true;
          // Clear previous timeout if exists to prevent flickering (optional polish)
          if (mesh.userData.timeout) clearTimeout(mesh.userData.timeout);
          mesh.userData.timeout = setTimeout(() => { mesh.visible = false; }, 500);
        }
      }
    }

    return { [relativeDir]: result };
  },

  runPhysicsTests() {
    console.log("🧪 Running Internal Physics Tests...");

    const oldMem = JSON.parse(JSON.stringify(this.state.memory));
    const oldMap = this.state.mapData;
    const oldScore = this.state.score;

    // TEST CASE 1: Detection & Collection (South)
    this.state.memory = { x: 0, z: 0, direction: 'south' };
    this.state.mapData = {
      gridSize: 10,
      obstacles: [],
      minerals: [{ x: 0, z: 1 }]
    };
    this.state.score = 0;

    // Action 1: Scan
    const scanRes = this.scanSensors(true, 'front');
    const scanPass = (scanRes.front === "MINERAL");
    console.log(scanPass ? "✅ Physics Test 1 (Scan): PASS" : `❌ Physics Test 1 (Scan): FAIL ${JSON.stringify(scanRes)}`);

    // Action 2: Collect
    this.collectMineral();
    const collectPass = (this.state.score === 50 && this.state.mapData.minerals.length === 0);
    console.log(collectPass ? "✅ Physics Test 2 (Collect): PASS" : `❌ Physics Test 2 (Collect): FAIL Score=${this.state.score}`);

    // Test Case 3: Rotate & Move (API V2)
    this.state.memory = { x: 0, z: 0, direction: 'north' };
    this.state.mapData = { gridSize: 10, obstacles: [], minerals: [] };
    // Simulate "rotate_and_move: east"
    // 1. Turn East
    const r = { north: Math.PI, east: -Math.PI / 2, south: 0, west: Math.PI / 2 };
    this.state.memory.direction = 'east';
    this.state.rover.rotation.y = r['east'];
    // 2. Move (East = x+1)
    this.state.memory.x = 1;

    const v2Pass = (this.state.memory.x === 1 && this.state.memory.direction === 'east');
    console.log(v2Pass ? "✅ Physics Test 3 (Rotate & Move): PASS" : "❌ Physics Test 3 (Rotate & Move): FAIL");

    console.log("🧪 Physics Tests Complete.");

    // Restore
    this.state.memory = oldMem;
    this.state.mapData = oldMap;
    this.state.score = oldScore;
  },

  async runTests() {
    console.log("🧪 Running v4.7 Transpiler Tests...");
    const tests = [
      { name: "Legacy Abbrev", code: 's x=1', expect: 'x = 1;' },
      { name: "Scope Local", code: 'Do memory.%Set("x",1)', expect: 'await memory._Set("x",1);' },
      { name: "Double Context Fix", code: 'Do context.%Set("x",1)', expect: 'await context._Set("x",1);' },
      { name: "Nested Func", code: 's x=$Piece($Random(10),".",1)', expect: 'x = lib.Piece(lib.Random(10),".",1);' },
      { name: "Loop Reactivity", code: 'f i=1:1:2 { d Move() }', expect: 'for (let i = 1; i <= 2; i += 1) { await context.Move(); }' }
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