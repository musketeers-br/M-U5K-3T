const API_BASE_URL = import.meta.env.PROD ? "/mu5k3t/api" : "/mu5k3t/api";

export class DynamicObjectWrapper {
  constructor(data = {}) {
    this.data = data;
  }

  _Get(key) {
    const val = this.data[key];
    // Crucial: return raw strings for comparisons to work (e.g. if sensors.front == "OBSTACLE")
    if (typeof val === 'string') return val;

    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return new DynamicObjectWrapper(val);
    }
    return val;
  }

  _Set(key, value) {
    this.data[key] = value;
  }

  _Push(value) {
    if (Array.isArray(this.data)) this.data.push(value);
  }

  _Pop() {
    if (Array.isArray(this.data)) return this.data.pop();
  }

  _ToJSON() {
    return JSON.stringify(this.data);
  }

  _IsDefined(key) {
    return key in this.data;
  }
}

const TOKEN_TYPES = {
  COMMAND: 'COMMAND',
  FUNCTION: 'FUNCTION',
  STRING: 'STRING',
  OPERATOR: 'OPERATOR',
  IDENTIFIER: 'IDENTIFIER',
  BLOCK_START: 'BLOCK_START',
  BLOCK_END: 'BLOCK_END',
  PAREN_START: 'PAREN_START',
  PAREN_END: 'PAREN_END',
  COMMA: 'COMMA',
  NUMBER: 'NUMBER',
  WHITESPACE: 'WHITESPACE',
  NEWLINE: 'NEWLINE'
};

class Tokenizer {
  constructor(input) {
    this.input = input;
    this.pos = 0;
    this.tokens = [];
  }

  tokenize() {
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];

      if (/\s/.test(char)) {
        if (char === '\n') {
          this.tokens.push({ type: TOKEN_TYPES.NEWLINE, value: '\n' });
        } else {
          this.tokens.push({ type: TOKEN_TYPES.WHITESPACE, value: char });
        }
        this.pos++;
        continue;
      }

      if (char === '"') {
        this.readString();
        continue;
      }

      // Allow % to start a word (for system classes/methods like %Get)
      if (/[a-zA-Z_%]/.test(char)) {
        this.readWord();
        continue;
      }

      if (/[0-9]/.test(char)) {
        this.readNumber();
        continue;
      }

      if (char === '{') {
        this.tokens.push({ type: TOKEN_TYPES.BLOCK_START, value: '{' });
        this.pos++;
        continue;
      }
      if (char === '}') {
        this.tokens.push({ type: TOKEN_TYPES.BLOCK_END, value: '}' });
        this.pos++;
        continue;
      }
      if (char === '(') {
        this.tokens.push({ type: TOKEN_TYPES.PAREN_START, value: '(' });
        this.pos++;
        continue;
      }
      if (char === ')') {
        this.tokens.push({ type: TOKEN_TYPES.PAREN_END, value: ')' });
        this.pos++;
        continue;
      }
      if (char === ',') {
        this.tokens.push({ type: TOKEN_TYPES.COMMA, value: ',' });
        this.pos++;
        continue;
      }

      // Operators
      if (['=', ':', '<', '>', '!', '+', '-', '*', '/'].includes(char)) {
        const next = this.input[this.pos + 1];
        if ((char === '>' || char === '<' || char === '!') && next === '=') {
          this.tokens.push({ type: TOKEN_TYPES.OPERATOR, value: char + '=' });
          this.pos += 2;
          continue;
        }
        this.tokens.push({ type: TOKEN_TYPES.OPERATOR, value: char });
        this.pos++;
        continue;
      }

      // dots for object access ._Method
      if (char === '.') {
        this.tokens.push({ type: TOKEN_TYPES.OPERATOR, value: '.' });
        this.pos++;
        continue;
      }

      // Unknown
      console.warn(`Unknown char: ${char}`);
      this.pos++;
    }
    return this.tokens;
  }

  readString() {
    let value = '';
    this.pos++; // Skip opening "
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      // Check for End of String (Quote NOT preceded by backslash)
      if (char === '"' && this.input[this.pos - 1] !== '\\') {
        break;
      }
      value += char;
      this.pos++;
    }
    this.pos++; // Skip closing "
    this.tokens.push({ type: TOKEN_TYPES.STRING, value });
  }

  readWord() {
    let value = '';
    // Allow % inside word too
    while (this.pos < this.input.length && /[a-zA-Z0-9_%]/.test(this.input[this.pos])) {
      value += this.input[this.pos];
      this.pos++;
    }

    const lower = value.toLowerCase();
    // Keywords mapping
    if (['set', 's'].includes(lower)) {
      this.tokens.push({ type: TOKEN_TYPES.COMMAND, value: 'Set' });
    } else if (['do', 'd'].includes(lower)) {
      this.tokens.push({ type: TOKEN_TYPES.COMMAND, value: 'Do' });
    } else if (['write', 'w'].includes(lower)) {
      this.tokens.push({ type: TOKEN_TYPES.COMMAND, value: 'Write' });
    } else if (['if', 'i'].includes(lower)) {
      this.tokens.push({ type: TOKEN_TYPES.COMMAND, value: 'If' });
    } else if (['elseif'].includes(lower)) {
      this.tokens.push({ type: TOKEN_TYPES.COMMAND, value: 'ElseIf' });
    } else if (['else', 'e'].includes(lower)) {
      this.tokens.push({ type: TOKEN_TYPES.COMMAND, value: 'Else' });
    } else if (['quit', 'q'].includes(lower)) {
      this.tokens.push({ type: TOKEN_TYPES.COMMAND, value: 'Quit' });
    } else {
      this.tokens.push({ type: TOKEN_TYPES.IDENTIFIER, value });
    }
  }

  readNumber() {
    let value = '';
    while (this.pos < this.input.length && /[0-9.]/.test(this.input[this.pos])) {
      value += this.input[this.pos];
      this.pos++;
    }
    this.tokens.push({ type: TOKEN_TYPES.NUMBER, value });
  }
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.output = '';
  }

  parse() {
    while (this.pos < this.tokens.length) {
      this.parseStatement();
    }
    return this.output;
  }

  peek() {
    return this.tokens[this.pos];
  }

  consume() {
    return this.tokens[this.pos++];
  }

  // Skip whitespace helpers
  skipWhitespace() {
    while (this.pos < this.tokens.length &&
      (this.tokens[this.pos].type === TOKEN_TYPES.WHITESPACE ||
        this.tokens[this.pos].type === TOKEN_TYPES.NEWLINE)) {
      this.pos++;
    }
  }

  parseStatement() {
    this.skipWhitespace();
    const token = this.peek();

    if (!token) return;

    if (token.type === TOKEN_TYPES.COMMAND) {
      this.consume();
      this.handleCommand(token.value);
    } else if (token.type === TOKEN_TYPES.BLOCK_START) {
      this.consume();
      this.output += ' {\n';
    } else if (token.type === TOKEN_TYPES.BLOCK_END) {
      this.consume();
      this.output += ' }\n';
    } else {
      // Unknown or Expression statement?
      // E.g. "x = 1" (invalid in COS usually, needs Set)
      // But comments/empty lines handled by tokenizer?
      // If we see Identifier or whatnot, check if it's a "Do-less" call?
      // Actually, let's just consume it to avoid loop if nothing else.
      this.consume();
    }
  }

  handleCommand(cmd) {
    let hasPostCond = false;
    let condition = '';

    // Check for Post-Conditional immediately (no skipWhitespace)
    if (this.peek() && this.peek().type === TOKEN_TYPES.OPERATOR && this.peek().value === ':') {
      hasPostCond = true;
      this.consume(); // Skip the colon
      // Parse condition until whitespace - this is a conditional context
      condition = this.parseExpression(true, true);
    }

    let isStatement = true;
    let js = '';

    if (cmd === 'Set') {
      js = this.parseSet() + ';';
    } else if (cmd === 'Write') {
      js = this.parseWrite() + ';';
    } else if (cmd === 'Do') {
      js = this.parseExpression() + ';';
    } else if (cmd === 'Quit') {
      js = 'return;';
    } else if (cmd === 'If') {
      isStatement = false;
      const cond = this.parseExpression(false, true);
      this.skipWhitespace();
      // COS If requires parentheses in JS
      js = `if (${cond})`;
    } else if (cmd === 'Else') {
      isStatement = false;
      js = 'else ';
    } else if (cmd === 'ElseIf') {
      isStatement = false;
      const cond = this.parseExpression(false, true);
      js = `else if (${cond}) `;
    }

    if (isStatement) {
      if (hasPostCond) {
        this.output += `if (${condition}) { ${js} }\n`;
      } else {
        this.output += js + '\n';
      }
    } else {
      if (hasPostCond) {
        this.output += `if (${condition}) { ${js} `;
      } else {
        this.output += js;
      }
    }
  }

  parseSet() {
    this.skipWhitespace();
    const id = this.consume();
    if (!id || id.type !== TOKEN_TYPES.IDENTIFIER) return '';

    this.skipWhitespace();
    const eq = this.consume();
    if (!eq || eq.value !== '=') return '';

    const val = this.parseExpression();
    return `var ${id.value} = ${val}`;
  }

  parseWrite() {
    const args = [];
    while (true) {
      const expr = this.parseExpression();
      args.push(expr);

      this.skipWhitespace();
      if (this.peek() && this.peek().type === TOKEN_TYPES.COMMA) {
        this.consume();
      } else {
        break;
      }
    }
    return `roverApi.Write(${args.join(', ')})`;
  }

  parseExpression(stopAtWhitespace = false, isConditional = false) {
    let expr = '';
    let balance = 0;

    while (this.pos < this.tokens.length) {
      const t = this.peek();

      if (balance === 0) {
        if (t.type === TOKEN_TYPES.BLOCK_START) break;
        if (t.type === TOKEN_TYPES.BLOCK_END) break;

        const isMemberAccess = expr.trim().endsWith('.');
        if (t.type === TOKEN_TYPES.COMMAND && !isMemberAccess) break;
        if (t.type === TOKEN_TYPES.COMMA && !isMemberAccess) break;
        if (t.type === TOKEN_TYPES.NEWLINE) break;
        if (stopAtWhitespace && t.type === TOKEN_TYPES.WHITESPACE) break;
      }

      if (t.type === TOKEN_TYPES.WHITESPACE) {
        this.consume();
        continue;
      }

      if (t.type === TOKEN_TYPES.PAREN_START || t.type === TOKEN_TYPES.BLOCK_START) {
        balance++;
      } else if (t.type === TOKEN_TYPES.PAREN_END || t.type === TOKEN_TYPES.BLOCK_END) {
        balance--;
      }

      let val = t.value;
      if (t.type === TOKEN_TYPES.STRING) {
        val = `"${val}"`;
      }
      else if (t.type === TOKEN_TYPES.BLOCK_START) {
        val = '{ ';
      }
      else if (t.type === TOKEN_TYPES.BLOCK_END) {
        val = ' }';
      }
      else if (t.type === TOKEN_TYPES.OPERATOR && val === '=') {
        // Use == only in conditional contexts (If, ElseIf, Post-conditionals)
        val = isConditional ? ' == ' : ' = ';
      }
      else if (t.type === TOKEN_TYPES.OPERATOR && ['<', '>', '<=', '>=', '!', '!='].includes(val)) {
        val = ` ${val} `;
      }
      else if (t.type === TOKEN_TYPES.OPERATOR && val === '.') val = '.';

      if (val.startsWith('%')) {
        val = '_' + val.substring(1);
      }

      expr += val;
      if (t.type === TOKEN_TYPES.COMMA) expr += ' ';
      if (t.type === TOKEN_TYPES.OPERATOR && val.trim() === ':') expr += ' ';
      this.consume();
    }
    return expr;
  }
}

export const MISSIONS = {
  'M1': {
    name: 'First Cut',
    briefing: 'Standard scouting mission. Collect 5 minerals in a stable environment to verify uplink integrity.',
    objectives: { minMinerals: 5 }
  },
  'M2': {
    name: 'Ghost Corridor',
    briefing: 'Navigate the narrow corridors of an ancient ridge. Extract 10 minerals and return to the landing base.',
    objectives: { minMinerals: 10, returnBase: true }
  },
  'M3': {
    name: 'Toxic Planet',
    briefing: 'Extreme conditions. Toxic vents are erupting across the surface. Collect 15 minerals and evacuate via the landing base.',
    objectives: { minMinerals: 15, returnBase: true }
  }
};

export class Simulation {
  constructor(gridSize = 25) {
    this.gridSize = gridSize;
    this.memory = {};
    this.grid = [];
  }

  generateMap() {
    this.grid = [];
    for (let x = 0; x < this.gridSize; x++) {
      this.grid[x] = [];
      for (let z = 0; z < this.gridSize; z++) {
        if (x === 0 && z === 0) {
          this.grid[x][z] = 'CLEAR';
          continue;
        }

        const rand = Math.random();
        if (rand < 0.15) {
          this.grid[x][z] = 'OBSTACLE';
        } else if (rand < 0.25) {
          this.grid[x][z] = 'MINERAL';
        } else {
          this.grid[x][z] = 'CLEAR';
        }
      }
    }
    return this.grid;
  }

  loadMap(data) {
    if (!data) return this.grid;

    // Support { grid, hazards } format or raw array
    const gridData = data.grid || data;
    const hazards = data.hazards || [];

    if (Array.isArray(gridData)) {
      this.grid = gridData;
      this.gridSize = gridData.length;

      // Apply hazards to grid
      hazards.forEach(h => {
        if (this.grid[h.x] && this.grid[h.x][h.z] === 'CLEAR') {
          this.grid[h.x][h.z] = 'HAZARD';
        }
      });
    }
    return this.grid;
  }

  static async fetchMapData(missionId, mode) {
    const safeMode = mode.toLowerCase() === 'deploy' ? 'DEPLOY' : 'SIMULATION';
    const url = `${API_BASE_URL}/map/${missionId}/${safeMode}`;

    console.log(`[Sim] Fetching Map: ${url}`);

    try {
      const res = await fetch(url);

      // Safety check for HTML response (common in CSP misconfig)
      const type = res.headers.get("content-type");
      if (type && type.includes("text/html")) {
        throw new Error("Received HTML instead of JSON. Check API Path.");
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      return data; // Returns { obstacles: [], minerals: [], gridSize: ... }
    } catch (e) {
      console.error("[Sim] Map Load Error:", e);
      throw e;
    }
  }

  transpileCOS(cosCode) {
    console.log("Input COS:", cosCode);

    // 1. Tokenize
    const tokenizer = new Tokenizer(cosCode);
    const tokens = tokenizer.tokenize();
    console.log("Tokens:", tokens);

    // 2. Parse
    const parser = new Parser(tokens);
    const jsCode = parser.parse();

    console.log("Transpiled JS:", jsCode);
    return jsCode;
  }

  runMission(userCode, startX = 0, startZ = 0, externalHistory = null) {
    if (externalHistory && Array.isArray(externalHistory)) {
      console.log('Using external history from backend:', externalHistory);
      return { history: externalHistory, error: null };
    }

    if (this.grid.length === 0) this.generateMap();

    const activeMission = MISSIONS[this.missionId] || MISSIONS['M1'];
    let fuel = 100;
    let score = 0;
    let hp = 100;

    const jsBody = this.transpileCOS(userCode);

    let userFunction;
    try {
      userFunction = new Function('context', 'roverApi', jsBody);
    } catch (e) {
      console.error(e);
      return { error: `Transpilation Error: ${e.message}` };
    }

    const history = [];
    let currentX = startX;
    let currentZ = startZ;

    if (!this.memory.direction) this.memory.direction = 'north';

    const MAX_SAFETY_TICKS = 2000;
    let tick = 1;

    while (fuel > 0 && hp > 0 && tick <= MAX_SAFETY_TICKS) {
      const tickActions = [];

      // 1. Prepare Context & Prepare Sensors for Visualization
      const scanResult = this.scan(currentX, currentZ);
      const currentDir = this.memory.direction || 'north';
      let dirX = 0, dirZ = 0;
      if (currentDir === 'north') dirZ = -1;
      else if (currentDir === 'south') dirZ = 1;
      else if (currentDir === 'east') dirX = 1;
      else if (currentDir === 'west') dirX = -1;

      // Calculate sensor coordinates for the SCAN action
      const txF = currentX + dirX;
      const tzF = currentZ + dirZ;
      const txFF = currentX + (dirX * 2);
      const tzFF = currentZ + (dirZ * 2);

      let lx = currentX, lz = currentZ;
      let rx = currentX, rz = currentZ;
      if (currentDir === 'north') { lx = currentX - 1; rx = currentX + 1; }
      else if (currentDir === 'south') { lx = currentX + 1; rx = currentX - 1; }
      else if (currentDir === 'east') { lz = currentZ - 1; rz = currentZ + 1; }
      else if (currentDir === 'west') { lz = currentZ + 1; rz = currentZ - 1; }

      // Push initial SCAN action for this tick
      tickActions.push({
        type: 'SCAN',
        x: currentX, z: currentZ,
        txF, tzF,
        txFF, tzFF,
        txL: lx, tzL: lz,
        txR: rx, tzR: rz
      });

      const rawData = {
        rover: {
          sensors: scanResult,
          fuel,
          score,
          hp,
          x: currentX,
          z: currentZ
        },
        memory: this.memory,
        output: { action: "WAIT", param: "" }
      };

      const context = new DynamicObjectWrapper(rawData);
      const roverApi = {
        Write: (...args) => {
          tickActions.push({ type: 'PRINT', message: args.join(" ") });
        }
      };

      // 2. Execute User Code
      try {
        userFunction(context, roverApi);
      } catch (err) {
        console.error("Runtime Error:", err);
        return { error: `Runtime Error (Tick ${tick}): ${err.message}` };
      }

      // 3. Process Output
      const output = rawData.output;
      const action = output.action;
      const param = output.param;

      if (action === "MOVE") {
        if (fuel > 0) {
          const d = param ? param.toLowerCase() : '';
          let nextX = currentX;
          let nextZ = currentZ;
          if (d === 'north') nextZ -= 1;
          else if (d === 'south') nextZ += 1;
          else if (d === 'east') nextX += 1;
          else if (d === 'west') nextX -= 1;

          if (this.isValid(nextX, nextZ)) {
            currentX = nextX;
            currentZ = nextZ;
            fuel -= 1;
            tickActions.push({ type: 'MOVE', x: currentX, z: currentZ, direction: d });

            if (this.grid[currentX][currentZ] === 'MINERAL') {
              score += 50;
              this.grid[currentX][currentZ] = 'CLEAR';
              tickActions.push({ type: 'COLLECT', x: currentX, z: currentZ, score: score });
            }
          } else {
            // Collision or Blocked
            const isOOB = !(nextX >= 0 && nextX < this.gridSize && nextZ >= 0 && nextZ < this.gridSize);
            if (isOOB) {
              tickActions.push({ type: 'BLOCKED', x: currentX, z: currentZ, direction: d, reason: 'boundary' });
            } else {
              // Obstacle
              hp -= 20;
              tickActions.push({ type: 'COLLISION', x: nextX, z: nextZ, currentHP: hp });
              tickActions.push({ type: 'BLOCKED', x: currentX, z: currentZ, direction: d, reason: 'obstacle' });
            }
          }

          // Check for Hazard effect after movement
          if (this.grid[currentX][currentZ] === 'HAZARD') {
            fuel -= 4; // Total cost 5 (1 baseline + 4 penalty)
            hp -= 2;
            tickActions.push({ type: 'HAZARD_EFFECT', x: currentX, z: currentZ, currentHP: hp, currentFuel: fuel });
            tickActions.push({ type: 'PRINT', message: "Warning: Hazardous Terrain Entered!" });
          }

          if (hp <= 0) {
            tickActions.push({ type: 'GAMEOVER', reason: 'Hull Critical - Destruction Imminent' });
            history.push({ tick, x: currentX, z: currentZ, actions: tickActions, fuel, score, hp });
            break;
          }
        } else {
          tickActions.push({ type: 'GAMEOVER', reason: 'Fuel Empty' });
          history.push({ tick, x: currentX, z: currentZ, actions: tickActions, fuel, score, hp });
          break;
        }
      } else if (action === "TURN") {
        if (param) {
          this.memory.direction = param.toLowerCase();
          tickActions.push({ type: 'TURN', param: param });
        }
      } else if (action === "SAY") {
        tickActions.push({ type: 'SAY', message: param });
      }

      // Base Station Fuel Recharge (0,0)
      if (currentX === 0 && currentZ === 0) {
        fuel = 100;
        tickActions.push({ type: 'REFUEL', fuel: 100 });
      }

      // --- Victory Check ---
      const obj = activeMission.objectives;
      if (obj) {
        const mineralCount = score / 50;
        const mineralsMet = mineralCount >= obj.minMinerals;
        const fuelMet = obj.minFuel ? fuel >= obj.minFuel : true;
        const atBase = (currentX === 0 && currentZ === 0);
        const baseMet = obj.returnBase ? atBase : true;

        if (mineralsMet && fuelMet && baseMet) {
          tickActions.push({
            type: 'VICTORY',
            finalScore: score,
            finalFuel: fuel,
            minerals: mineralCount
          });
          history.push({ tick, x: currentX, z: currentZ, actions: tickActions, fuel, score, hp });
          break;
        }
      }

      history.push({
        tick,
        x: currentX,
        z: currentZ,
        actions: tickActions,
        fuel,
        score,
        hp
      });

      if (fuel <= 0 || hp <= 0) break;
      tick++;
    }

    if (tick > MAX_SAFETY_TICKS && fuel > 0 && hp > 0) {
      history[history.length - 1].actions.push({ type: 'GAMEOVER', reason: 'Mission Timeout (Safety Limit Reached)' });
    } else if (fuel <= 0 && hp > 0) {
      // Check if last tick already has a GAMEOVER (e.g. from MOVE inside)
      const lastTick = history[history.length - 1];
      const hasGameOver = lastTick.actions.some(a => a.type === 'GAMEOVER');
      if (!hasGameOver) {
        lastTick.actions.push({ type: 'GAMEOVER', reason: 'Fuel Empty' });
      }
    }

    return { history, error: null };
  }

  isValid(x, z) {
    return x >= 0 && x < this.gridSize && z >= 0 && z < this.gridSize && this.grid[x][z] !== 'OBSTACLE';
  }

  scan(x, z) {
    const get = (gx, gz) => {
      if (!this.isValid(gx, gz)) return 'OBSTACLE';
      return this.grid[gx][gz];
    };

    // Extended Sensors Mk.3
    // Relies on memory.direction to compute directional sensors
    const dir = this.memory.direction || 'north'; // Default

    let fx = x, fz = z;      // front (1 tile)
    let ffx = x, ffz = z;    // front_far (2 tiles)
    let lx = x, lz = z;      // left
    let rx = x, rz = z;      // right

    if (dir === 'north') {
      fz = z - 1; ffz = z - 2;
      lx = x - 1; // left is west
      rx = x + 1; // right is east
    } else if (dir === 'south') {
      fz = z + 1; ffz = z + 2;
      lx = x + 1; // left is east
      rx = x - 1; // right is west
    } else if (dir === 'east') {
      fx = x + 1; ffx = x + 2;
      lz = z - 1; // left is north
      rz = z + 1; // right is south
    } else if (dir === 'west') {
      fx = x - 1; ffx = x - 2;
      lz = z + 1; // left is south
      rz = z - 1; // right is north
    }

    return {
      north: get(x, z - 1),
      south: get(x, z + 1),
      east: get(x + 1, z),
      west: get(x - 1, z),
      under: get(x, z),
      front: get(fx, fz),
      front_far: get(ffx, ffz),
      left: get(lx, lz),
      right: get(rx, rz)
    };
  }

  // --- Test Suite for Transpiler ---
  static runTests() {
    console.log('\n🧪 RUNNING TRANSPILER TEST SUITE 🧪\n');

    const sim = new Simulation();
    let passCount = 0;
    let failCount = 0;

    const runTest = (name, input, expectedPattern, shouldNotContain = null) => {
      try {
        const result = sim.transpileCOS(input);

        let passed = true;

        // Check if result contains expected pattern
        if (typeof expectedPattern === 'string') {
          if (!result.includes(expectedPattern)) {
            passed = false;
            console.log(`❌ FAIL: ${name}`);
            console.log(`   Input: ${input}`);
            console.log(`   Expected to contain: "${expectedPattern}"`);
            console.log(`   Got: ${result}`);
            failCount++;
            return;
          }
        } else if (expectedPattern instanceof RegExp) {
          if (!expectedPattern.test(result)) {
            passed = false;
            console.log(`❌ FAIL: ${name}`);
            console.log(`   Input: ${input}`);
            console.log(`   Expected pattern: ${expectedPattern}`);
            console.log(`   Got: ${result}`);
            failCount++;
            return;
          }
        }

        // Check if result should NOT contain certain strings
        if (shouldNotContain && result.includes(shouldNotContain)) {
          passed = false;
          console.log(`❌ FAIL: ${name}`);
          console.log(`   Input: ${input}`);
          console.log(`   Should NOT contain: "${shouldNotContain}"`);
          console.log(`   Got: ${result}`);
          failCount++;
          return;
        }

        if (passed) {
          console.log(`✅ PASS: ${name}`);
          passCount++;
        }
      } catch (error) {
        console.log(`❌ FAIL: ${name} (Exception)`);
        console.log(`   Error: ${error.message}`);
        failCount++;
      }
    };

    // Test 1: Abbreviations
    console.log('\n--- Test 1: Abbreviations ---');
    runTest(
      'Set abbreviation (s)',
      's x=1',
      'var x = 1;'
    );
    runTest(
      'Assignment vs Equality (Set)',
      's x=1',
      'x = 1',
      'x == 1' // Should NOT use == for assignment
    );
    runTest(
      'Write abbreviation (w)',
      'w "hi"',
      'roverApi.Write("hi");'
    );
    runTest(
      'Do abbreviation (d)',
      'd context.%Set("output", { "action": "MOVE" })',
      'context._Set'
    );

    // Test 2: Post-Conditionals
    console.log('\n--- Test 2: Post-Conditionals ---');
    runTest(
      'Post-conditional Set',
      'Set:fuel<10 action="REFUEL"',
      /if\s*\(\s*fuel\s*<\s*10\s*\)/
    );
    runTest(
      'Post-conditional with Equality',
      'Set:x=5 status="READY"',
      /if\s*\(\s*x\s*==\s*5\s*\)/ // Should use == in conditional
    );
    runTest(
      'Post-conditional Write',
      'Write:x>5 "Big value"',
      /if\s*\(\s*x\s*>\s*5\s*\)/
    );

    // Test 3: String Handling (Braces)
    console.log('\n--- Test 3: String Handling ---');
    runTest(
      'String with braces',
      'Write "Hello {Brackets}"',
      '"Hello {Brackets}"',
      'Hello " + Brackets + "'  // Should NOT split the string
    );
    runTest(
      'String with embedded JSON',
      'Set data="{ \\"key\\": \\"value\\" }"',
      '{ \\"key\\": \\"value\\" }'
    );

    // Test 4: Case Sensitivity
    console.log('\n--- Test 4: Case Sensitivity ---');
    runTest(
      'Lowercase if',
      'if x=1 { w "yes" }',
      /if\s*\(/
    );
    runTest(
      'Uppercase IF',
      'IF x=1 { w "yes" }',
      /if\s*\(/
    );
    runTest(
      'Mixed case If',
      'If x=1 { w "yes" }',
      /if\s*\(/
    );
    runTest(
      'Mixed case Set',
      'SET y=2',
      'var y = 2;'
    );

    // Test 5: Dynamic Objects
    console.log('\n--- Test 5: Dynamic Objects ---');
    runTest(
      '%Get method',
      'Set rover = context.%Get("rover")',
      'context._Get("rover")'
    );
    runTest(
      '%Set method',
      'Do context.%Set("output", value)',
      'context._Set("output", value)'
    );
    runTest(
      'Multiple %Get calls',
      'Set sensors = rover.%Get("sensors")',
      'rover._Get("sensors")'
    );

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`📊 TEST SUMMARY`);
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📈 Total:  ${passCount + failCount}`);
    console.log(`🎯 Success Rate: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);
    console.log('='.repeat(50) + '\n');

    return { passCount, failCount, total: passCount + failCount };
  }
}
