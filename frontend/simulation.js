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

export class Lexer {
  constructor(code) {
    this.code = code;
    this.pos = 0;
    this.tokens = [];
  }

  tokenize() {
    while (this.pos < this.code.length) {
      const char = this.code[this.pos];

      // Skip carriage returns
      if (char === '\r') {
        this.pos++;
        continue;
      }

      // Handle newlines
      if (char === '\n') {
        this.tokens.push({ type: TOKEN_TYPES.NEWLINE, value: '\n' });
        this.pos++;
        continue;
      }

      // Handle comments (ignore until end of line)
      if (char === '/' && this.code[this.pos + 1] === '/') {
        this.skipComment();
        continue;
      }

      // Handle whitespace (but preserve it for some cases)
      if (/\s/.test(char) && char !== '\n') {
        const start = this.pos;
        while (this.pos < this.code.length && /\s/.test(this.code[this.pos]) && this.code[this.pos] !== '\n') {
          this.pos++;
        }
        continue;
      }

      // Handle strings
      if (char === '"') {
        this.readString();
        continue;
      }

      // Handle numbers
      if (/[0-9]/.test(char)) {
        this.readNumber();
        continue;
      }

      // Handle identifiers and keywords
      if (/[a-zA-Z_]/.test(char)) {
        this.readIdentifier();
        continue;
      }

      // Handle operators and special characters
      if (this.handleOperators()) {
        continue;
      }

      // Unknown character - skip it
      this.pos++;
    }

    return this.tokens;
  }

  skipComment() {
    // Skip until newline or end of string
    while (this.pos < this.code.length && this.code[this.pos] !== '\n') {
      this.pos++;
    }
  }

  readString() {
    let value = '';
    this.pos++; // Skip opening quote

    while (this.pos < this.code.length) {
      const char = this.code[this.pos];
      
      // Handle escaped quotes
      if (char === '\\' && this.code[this.pos + 1] === '"') {
        value += '"';
        this.pos += 2;
        continue;
      }

      // End of string
      if (char === '"') {
        break;
      }

      value += char;
      this.pos++;
    }

    this.pos++; // Skip closing quote
    this.tokens.push({ type: TOKEN_TYPES.STRING, value });
  }

  readNumber() {
    let value = '';
    while (this.pos < this.code.length && /[0-9.]/.test(this.code[this.pos])) {
      value += this.code[this.pos];
      this.pos++;
    }
    this.tokens.push({ type: TOKEN_TYPES.NUMBER, value });
  }

  readIdentifier() {
    let value = '';
    while (this.pos < this.code.length && /[a-zA-Z0-9_]/.test(this.code[this.pos])) {
      value += this.code[this.pos];
      this.pos++;
    }

    // Check if it's a keyword
    const lower = value.toLowerCase();
    if (['for', 'if', 'else', 'elseif', 'set', 'do', 'write', 'quit', 'return'].includes(lower)) {
      this.tokens.push({ type: TOKEN_TYPES.COMMAND, value });
    } else {
      this.tokens.push({ type: TOKEN_TYPES.IDENTIFIER, value });
    }
  }

  handleOperators() {
    const char = this.code[this.pos];
    const next = this.code[this.pos + 1];

    // Block start/end
    if (char === '{') {
      this.tokens.push({ type: TOKEN_TYPES.BLOCK_START, value: '{' });
      this.pos++;
      return true;
    }
    if (char === '}') {
      this.tokens.push({ type: TOKEN_TYPES.BLOCK_END, value: '}' });
      this.pos++;
      return true;
    }

    // Parentheses
    if (char === '(') {
      this.tokens.push({ type: TOKEN_TYPES.PAREN_START, value: '(' });
      this.pos++;
      return true;
    }
    if (char === ')') {
      this.tokens.push({ type: TOKEN_TYPES.PAREN_END, value: ')' });
      this.pos++;
      return true;
    }

    // Comma
    if (char === ',') {
      this.tokens.push({ type: TOKEN_TYPES.COMMA, value: ',' });
      this.pos++;
      return true;
    }

    // Colon (used in For loops: start:step:end)
    if (char === ':') {
      this.tokens.push({ type: TOKEN_TYPES.COLON, value: ':' });
      this.pos++;
      return true;
    }

    // Assignment (=) and Equality (==)
    if (char === '=') {
      if (next === '=') {
        this.tokens.push({ type: TOKEN_TYPES.OPERATOR, value: '==' });
        this.pos += 2;
      } else {
        this.tokens.push({ type: TOKEN_TYPES.OPERATOR, value: '=' });
        this.pos++;
      }
      return true;
    }

    // Dot (for %Get and other properties)
    if (char === '.') {
      this.tokens.push({ type: TOKEN_TYPES.OPERATOR, value: '.' });
      this.pos++;
      return true;
    }

    // Underscore (string concat in COS)
    if (char === '_') {
      this.tokens.push({ type: TOKEN_TYPES.OPERATOR, value: '+' }); // Convert to JS +
      this.pos++;
      return true;
    }

    // Comparison operators
    if (['<', '>', '!'].includes(char)) {
      if (next === '=') {
        this.tokens.push({ type: TOKEN_TYPES.OPERATOR, value: char + '=' });
        this.pos += 2;
      } else {
        this.tokens.push({ type: TOKEN_TYPES.OPERATOR, value: char });
        this.pos++;
      }
      return true;
    }

    return false;
  }
}

// ============================================
// NEW PARSER - Token to JavaScript
// ============================================
export class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.output = [];
  }

  parse() {
    this.output = [];

    while (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];

      // Skip newlines at top level (they're just separators)
      if (token.type === TOKEN_TYPES.NEWLINE) {
        this.pos++;
        continue;
      }

      this.parseStatement();
    }

    return this.output.join('');
  }

  parseStatement() {
    const token = this.tokens[this.pos];

    if (!token) return;

    // Skip newlines
    if (token.type === TOKEN_TYPES.NEWLINE) {
      this.pos++;
      return;
    }

    // Handle commands
    if (token.type === TOKEN_TYPES.COMMAND) {
      this.handleCommand(token.value);
      return;
    }

    // Handle identifiers (likely function calls or expressions)
    if (token.type === TOKEN_TYPES.IDENTIFIER) {
      // Check if it's followed by a paren (function call)
      if (this.peekNext()?.type === TOKEN_TYPES.PAREN_START) {
        // Function call - output as-is
        this.output.push(token.value);
        this.pos++;
      } else {
        // Unknown identifier - skip it
        this.pos++;
      }
      return;
    }

    // Skip unknown tokens
    this.pos++;
  }

  handleCommand(cmd) {
    const lowerCmd = cmd.toLowerCase();
    const cmdToken = this.tokens[this.pos];
    this.pos++; // Consume command

    switch (lowerCmd) {
      case 'for':
        this.parseForLoop();
        break;

      case 'set':
        this.parseSet();
        break;

      case 'do':
        this.parseDo();
        break;

      case 'if':
        this.parseIf();
        break;

      case 'elseif':
        this.parseElseIf();
        break;

      case 'else':
        this.parseElse();
        break;

      case 'write':
        this.parseWrite();
        break;

      case 'quit':
      case 'return':
        this.output.push('return;');
        break;

      default:
        // Unknown command - skip it
        break;
    }
  }

  parseForLoop() {
    // Expect: For var = start : step : end { body }
    if (this.pos >= this.tokens.length) return;
    
    const varName = this.tokens[this.pos].value;
    this.pos++;

    // Expect =
    if (this.pos >= this.tokens.length) return;
    if (this.tokens[this.pos].value !== '=') {
      this.pos++;
      return;
    }
    this.pos++;

    // Read start value
    if (this.pos >= this.tokens.length) return;
    const start = this.tokens[this.pos].value;
    this.pos++;

    // Expect :
    if (this.pos >= this.tokens.length) return;
    if (this.tokens[this.pos].type !== TOKEN_TYPES.COLON) {
      this.pos++;
      return;
    }
    this.pos++;

    // Read step
    if (this.pos >= this.tokens.length) return;
    const step = this.tokens[this.pos].value;
    this.pos++;

    // Expect :
    if (this.pos >= this.tokens.length) return;
    if (this.tokens[this.pos].type !== TOKEN_TYPES.COLON) {
      this.pos++;
      return;
    }
    this.pos++;

    // Read end
    if (this.pos >= this.tokens.length) return;
    const end = this.tokens[this.pos].value;
    this.pos++;

    this.output.push(`for (let ${varName} = ${start}; ${varName} <= ${end}; ${varName} += ${step}) {`);
    this.parseBlockBody();
    this.output.push('}');
  }

  parseSet() {
    if (this.pos >= this.tokens.length) return;

    const nextToken = this.tokens[this.pos];

    if (nextToken.type === TOKEN_TYPES.IDENTIFIER) {
      let varName = nextToken.value;
      this.pos++;

      // Check for %Get pattern
      while (this.pos < this.tokens.length && this.tokens[this.pos].type === TOKEN_TYPES.OPERATOR) {
        const op = this.tokens[this.pos].value;
        this.pos++;

        if (op === '%' && this.pos < this.tokens.length && this.tokens[this.pos].type === TOKEN_TYPES.IDENTIFIER) {
          const method = this.tokens[this.pos].value;
          this.pos++;

          if (this.pos < this.tokens.length && this.tokens[this.pos].type === TOKEN_TYPES.PAREN_START) {
            this.pos++;
            let key = '';
            if (this.pos < this.tokens.length && this.tokens[this.pos].type === TOKEN_TYPES.STRING) {
              key = this.tokens[this.pos].value;
            } else if (this.pos < this.tokens.length && this.tokens[this.pos].type === TOKEN_TYPES.IDENTIFIER) {
              key = this.tokens[this.pos].value;
            }
            this.pos++;
            if (this.pos < this.tokens.length && this.tokens[this.pos].type === TOKEN_TYPES.PAREN_END) {
              this.pos++;
            }
            varName = `${varName}._Get("${key}")`;
          }
        } else if (op === '.') {
          if (this.pos < this.tokens.length && this.tokens[this.pos].type === TOKEN_TYPES.IDENTIFIER) {
            varName += '.' + this.tokens[this.pos].value;
            this.pos++;
          }
        }
      }

      if (this.pos < this.tokens.length && this.tokens[this.pos].type === TOKEN_TYPES.OPERATOR && this.tokens[this.pos].value === '=') {
        this.pos++;
        let value = this.parseValue();
        this.output.push(`var ${varName} = ${value};`);
      }
    }
  }

  parseDo() {
    if (this.pos >= this.tokens.length) return;

    const methodName = this.tokens[this.pos].value;
    this.pos++;

    if (this.pos >= this.tokens.length || this.tokens[this.pos].type !== TOKEN_TYPES.PAREN_START) {
      this.output.push(`await context.${methodName}();`);
      return;
    }
    this.pos++;

    let param = '';
    if (this.pos < this.tokens.length && this.tokens[this.pos].type === TOKEN_TYPES.STRING) {
      param = this.tokens[this.pos].value;
      this.pos++;
    } else if (this.pos < this.tokens.length && this.tokens[this.pos].type === TOKEN_TYPES.IDENTIFIER) {
      param = this.tokens[this.pos].value;
      this.pos++;
    }

    if (this.pos < this.tokens.length && this.tokens[this.pos].type === TOKEN_TYPES.PAREN_END) {
      this.pos++;
    }

    if (param) {
      this.output.push(`await context.${methodName}(${param});`);
    } else {
      this.output.push(`await context.${methodName}();`);
    }
  }

  parseIf() {
    const condition = this.parseCondition();
    if (this.pos < this.tokens.length && this.tokens[this.pos].type === TOKEN_TYPES.BLOCK_START) {
      this.pos++;
      this.output.push(`if (${condition}) {`);
      this.parseBlockBody();
      this.output.push('}');
    }
  }

  parseElseIf() {
    const condition = this.parseCondition();
    if (this.pos < this.tokens.length && this.tokens[this.pos].type === TOKEN_TYPES.BLOCK_START) {
      this.pos++;
      this.output.push(`else if (${condition}) {`);
      this.parseBlockBody();
      this.output.push('}');
    }
  }

  parseElse() {
    if (this.pos < this.tokens.length && this.tokens[this.pos].type === TOKEN_TYPES.BLOCK_START) {
      this.pos++;
      this.output.push('else {');
      this.parseBlockBody();
      this.output.push('}');
    }
  }

  parseWrite() {
    let output = '';
    
    while (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];
      
      if (token.type === TOKEN_TYPES.NEWLINE || (token.type === TOKEN_TYPES.COMMAND)) {
        break;
      }

      if (token.type === TOKEN_TYPES.STRING) {
        output += `"${token.value}"`;
      } else if (token.type === TOKEN_TYPES.IDENTIFIER) {
        output += token.value;
      } else if (token.type === TOKEN_TYPES.OPERATOR && token.value === '+') {
        output += ' + ';
      }
      
      this.pos++;
    }

    this.output.push(`roverApi.Write(${output});`);
  }

  parseCondition() {
    let condition = '';
    let depth = 0;

    while (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];

      if (token.type === TOKEN_TYPES.NEWLINE) {
        break;
      }

      if (token.type === TOKEN_TYPES.BLOCK_START) {
        depth++;
        condition += token.value;
      } else if (token.type === TOKEN_TYPES.BLOCK_END) {
        if (depth === 0) break;
        depth--;
        condition += token.value;
      } else if (depth === 0 && token.type === TOKEN_TYPES.COMMAND) {
        break;
      } else {
        if (token.type === TOKEN_TYPES.IDENTIFIER) {
          condition += token.value;
        } else if (token.type === TOKEN_TYPES.NUMBER) {
          condition += token.value;
        } else if (token.type === TOKEN_TYPES.STRING) {
          condition += `"${token.value}"`;
        } else if (token.type === TOKEN_TYPES.OPERATOR) {
          if (token.value === '=') {
            condition += ' = ';
          } else if (token.value === '==') {
            condition += ' == ';
          } else if (['<', '>', '<=', '>='].includes(token.value)) {
            condition += ` ${token.value} `;
          } else {
            condition += token.value;
          }
        } else if (token.type === TOKEN_TYPES.PAREN_START) {
          condition += '(';
        } else if (token.type === TOKEN_TYPES.PAREN_END) {
          condition += ')';
        }
      }

      this.pos++;
    }

    return condition.trim();
  }

  parseValue() {
    let value = '';
    let depth = 0;

    while (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];

      if (token.type === TOKEN_TYPES.NEWLINE) {
        break;
      }

      if (token.type === TOKEN_TYPES.BLOCK_START || token.type === TOKEN_TYPES.BLOCK_END) {
        break;
      }

      if (token.type === TOKEN_TYPES.COMMAND) {
        break;
      }

      if (token.type === TOKEN_TYPES.OPERATOR && token.value === '=') {
        break;
      }

      if (token.type === TOKEN_TYPES.OPERATOR && token.value === '+') {
        value += ' + ';
      } else if (token.type === TOKEN_TYPES.STRING) {
        value += `"${token.value}"`;
      } else if (token.type === TOKEN_TYPES.NUMBER) {
        value += token.value;
      } else if (token.type === TOKEN_TYPES.IDENTIFIER) {
        value += token.value;
      } else if (token.type === TOKEN_TYPES.PAREN_START) {
        value += '(';
        depth++;
      } else if (token.type === TOKEN_TYPES.PAREN_END) {
        if (depth === 0) break;
        value += ')';
        depth--;
      } else if (token.type === TOKEN_TYPES.OPERATOR) {
        value += token.value;
      }

      this.pos++;
    }

    return value.trim();
  }

  parseBlockBody() {
    while (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];

      if (token.type === TOKEN_TYPES.BLOCK_END) {
        this.pos++;
        break;
      }

      if (token.type === TOKEN_TYPES.NEWLINE) {
        this.pos++;
        continue;
      }

      this.parseStatement();
    }
  }

  peekNext() {
    return this.tokens[this.pos + 1];
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

export const Simulation = {
  state: {
    rover: null,
    mapData: null,
    scene: null,
    updateHUD: null,
    running: false,
    fuel: 100,
    health: 100,
    interval: null,
    gridSize: 25,
    memory: {},
    grid: [],
    missionId: 'M1'
  },

  init(mapData, roverMesh, scene, onHudUpdate) {
    console.log("⚙️ Simulation Engine: Initializing...");

    // 1. Store References
    this.state.mapData = mapData;
    this.state.rover = roverMesh;
    this.state.scene = scene;
    this.state.updateHUD = onHudUpdate;

    // 2. Reset Metrics
    this.state.fuel = 100;
    this.state.health = 100;
    this.state.running = false;
    this.state.memory = {};

    // 3. Reset Physics/Visuals
    if (this.state.rover) {
      // Assuming starting at 0,0 for M1. 
      // Future: Use mapData.baseStation.x/z if available
      this.state.rover.position.set(0, 0, 0);
      this.state.rover.rotation.set(0, 0, 0);
    }

    // 4. Initial HUD Update
    if (this.state.updateHUD) {
      this.state.updateHUD({
        fuel: this.state.fuel,
        health: this.state.health,
        status: "READY"
      });
    }

    // Initialize grid from mapData if available
    if (mapData) {
      this.loadMap(mapData);
    }
  },

  stop() {
    this.state.running = false;
    if (this.state.interval) clearInterval(this.state.interval);
    console.log("🛑 Simulation Stopped");
  },

  async runCode() {
    if (!this.state.rover) {
      alert("Rover not initialized!");
      return;
    }

    console.log("⚡ Executing Auto-Pilot Sequence...");
    this.state.running = true;

    // HARDCODED DEMO SEQUENCE (Bypasses Transpiler for now)
    const commands = ['MOVE', 'MOVE', 'TURN_LEFT', 'MOVE', 'MOVE', 'COLLECT'];
    let step = 0;

    this.state.interval = setInterval(() => {
      if (!this.state.running || step >= commands.length) {
        this.stop();
        return;
      }

      const cmd = commands[step];
      console.log(`🤖 Rover Action: ${cmd}`);

      // PHYSICS & VISUALS (Mock)
      if (cmd === 'MOVE') {
        this.state.rover.translateZ(1.2); // Move 1.2 units forward (TILE_SIZE)
        this.state.fuel -= 5;
      }
      else if (cmd === 'TURN_LEFT') {
        this.state.rover.rotateY(Math.PI / 2);
      }
      else if (cmd === 'TURN_RIGHT') {
        this.state.rover.rotateY(-Math.PI / 2);
      }
      else if (cmd === 'COLLECT') {
        // Visual feedback only for now
        console.log("✨ Scanning for minerals...");
      }

      // HUD UPDATE
      if (this.state.updateHUD) {
        this.state.updateHUD({
          fuel: this.state.fuel,
          health: this.state.health,
          status: `EXEC: ${cmd}`
        });
      }

      step++;
    }, 800); // 800ms per step
  },

  generateMap() {
    this.state.grid = [];
    for (let x = 0; x < this.state.gridSize; x++) {
      this.state.grid[x] = [];
      for (let z = 0; z < this.state.gridSize; z++) {
        if (x === 0 && z === 0) {
          this.state.grid[x][z] = 'CLEAR';
          continue;
        }

        const rand = Math.random();
        if (rand < 0.15) {
          this.state.grid[x][z] = 'OBSTACLE';
        } else if (rand < 0.25) {
          this.state.grid[x][z] = 'MINERAL';
        } else {
          this.state.grid[x][z] = 'CLEAR';
        }
      }
    }
    return this.state.grid;
  },

  loadMap(data) {
    if (!data) return this.state.grid;

    // Support { grid, hazards } format or raw array
    const gridData = data.grid || data;
    const hazards = data.hazards || [];

    if (Array.isArray(gridData)) {
      this.state.grid = gridData;
      this.state.gridSize = gridData.length;

      // Apply hazards to grid
      hazards.forEach(h => {
        if (this.state.grid[h.x] && this.state.grid[h.x][h.z] === 'CLEAR') {
          this.state.grid[h.x][h.z] = 'HAZARD';
        }
      });
    }
    return this.state.grid;
  },

  async fetchMapData(missionId, mode) {
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
  },

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
  },

  runMission(userCode, startX = 0, startZ = 0, externalHistory = null) {
    if (externalHistory && Array.isArray(externalHistory)) {
      console.log('Using external history from backend:', externalHistory);
      return { history: externalHistory, error: null };
    }

    if (this.state.grid.length === 0) this.generateMap();

    const activeMission = MISSIONS[this.state.missionId] || MISSIONS['M1'];
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

    if (!this.state.memory.direction) this.state.memory.direction = 'north';

    const MAX_SAFETY_TICKS = 2000;
    let tick = 1;

    while (fuel > 0 && hp > 0 && tick <= MAX_SAFETY_TICKS) {
      const tickActions = [];

      // 1. Prepare Context & Prepare Sensors for Visualization
      const scanResult = this.scan(currentX, currentZ);
      const currentDir = this.state.memory.direction || 'north';
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
        memory: this.state.memory,
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

            if (this.state.grid[currentX][currentZ] === 'MINERAL') {
              score += 50;
              this.state.grid[currentX][currentZ] = 'CLEAR';
              tickActions.push({ type: 'COLLECT', x: currentX, z: currentZ, score: score });
            }
          } else {
            // Collision or Blocked
            const isOOB = !(nextX >= 0 && nextX < this.state.gridSize && nextZ >= 0 && nextZ < this.state.gridSize);
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
          if (this.state.grid[currentX][currentZ] === 'HAZARD') {
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
          this.state.memory.direction = param.toLowerCase();
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
  },

  isValid(x, z) {
    return x >= 0 && x < this.state.gridSize && z >= 0 && z < this.state.gridSize && this.state.grid[x][z] !== 'OBSTACLE';
  },

  scan(x, z) {
    const get = (gx, gz) => {
      if (!this.isValid(gx, gz)) return 'OBSTACLE';
      return this.state.grid[gx][gz];
    };

    // Extended Sensors Mk.3
    // Relies on memory.direction to compute directional sensors
    const dir = this.state.memory.direction || 'north'; // Default

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
  },

  // --- Test Suite for Transpiler ---
  runTests() {
    console.log('\n🧪 RUNNING TRANSPILER TEST SUITE 🧪\n');

    const sim = Simulation;
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
