import { Lexer, Parser, Validator } from './simulation.js';

const code = 's x=$Piece($Random(10),".",1)';
console.log("Parsing:", code);

try {
  const tokens = new Lexer(code).tokenize();
  // console.log("Tokens:", tokens);
  new Validator(tokens).validate();
  const parser = new Parser(tokens);
  const js = parser.parse();
  console.log("Output JS:", js);
} catch (e) {
  console.error("Error:", e.message);
}
