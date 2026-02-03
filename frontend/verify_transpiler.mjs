import { Simulation, Lexer, Parser } from './simulation.js';

const sim = Simulation;

console.log("=".repeat(60));
console.log("🧪 TESTING NEW LEXER AND PARSER");
console.log("=".repeat(60));

// Test 1: Lexer Tokenization
console.log("\n--- Test 1: Lexer Tokenization ---");
const testCode1 = 'For i=1:1:5 { Do Move() }';
const lexer = new Lexer(testCode1);
const tokens1 = lexer.tokenize();
console.log(`Input: ${testCode1}`);
console.log(`Tokens: ${tokens1.length}`);
tokens1.forEach((t, i) => {
  console.log(`  ${i}: ${t.type} = "${t.value}"`);
});

// Test 2: Full Transpilation - For Loop
console.log("\n--- Test 2: For Loop Transpilation ---");
const testCode2 = 'For i=1:1:5 { Do Move() }';
const result2 = sim.transpileCOS(testCode2);
console.log(`Input:  ${testCode2}`);
console.log(`Output: ${result2}`);
const pass2 = result2.includes('for (let i = 1; i <= 5; i += 1)') && result2.includes('await context.Move()');
console.log(pass2 ? '✅ PASS' : '❌ FAIL');

// Test 3: Full Transpilation - Set with %Get
console.log("\n--- Test 3: Set with %Get ---");
const testCode3 = 'Set rover = context.%Get("rover")';
const result3 = sim.transpileCOS(testCode3);
console.log(`Input:  ${testCode3}`);
console.log(`Output: ${result3}`);
const pass3 = result3.includes('var rover') && result3.includes('context._Get("rover")');
console.log(pass3 ? '✅ PASS' : '❌ FAIL');

// Test 4: Full Transpilation - If Statement
console.log("\n--- Test 4: If Statement ---");
const testCode4 = 'If x=1 { Do Move() }';
const result4 = sim.transpileCOS(testCode4);
console.log(`Input:  ${testCode4}`);
console.log(`Output: ${result4}`);
const pass4 = result4.includes('if (x == 1)') && result4.includes('await context.Move()');
console.log(pass4 ? '✅ PASS' : '❌ FAIL');

// Test 5: Full Transpilation - Do with parameter
console.log("\n--- Test 5: Do with Parameter ---");
const testCode5 = 'Do Turn("right")';
const result5 = sim.transpileCOS(testCode5);
console.log(`Input:  ${testCode5}`);
console.log(`Output: ${result5}`);
const pass5 = result5.includes('await context.Turn("right")');
console.log(pass5 ? '✅ PASS' : '❌ FAIL');

// Test 6: Full Transpilation - Write
console.log("\n--- Test 6: Write Command ---");
const testCode6 = 'Write "Hello" _ name';
const result6 = sim.transpileCOS(testCode6);
console.log(`Input:  ${testCode6}`);
console.log(`Output: ${result6}`);
const pass6 = result6.includes('roverApi.Write') && result6.includes('"Hello"') && result6.includes('+');
console.log(pass6 ? '✅ PASS' : '❌ FAIL');

// Test 7: Complex ClassMethod
console.log("\n--- Test 7: ClassMethod Wrapper ---");
const testCode7 = `
ClassMethod OnTick(context As %DynamicObject)
{
  For i=1:1:3 {
    If context.%Get("rover").%Get("sensors").%Get("front") = "OBSTACLE" {
      Do Turn("right")
    } Else {
      Do Move()
    }
  }
}
`;
const result7 = sim.transpileCOS(testCode7);
console.log(`Input:  ClassMethod with nested For and If`);
console.log(`Output: ${result7}`);
const pass7 = result7.includes('for (let i = 1; i <= 3; i += 1)') && 
              result7.includes('if (') && 
              result7.includes('await context.Turn("right")') &&
              result7.includes('await context.Move()');
console.log(pass7 ? '✅ PASS' : '❌ FAIL');

// Test 8: Variable Step in For Loop
console.log("\n--- Test 8: Variable Step For Loop ---");
const testCode8 = 'For j=0:2:10 { Do Scan("front") }';
const result8 = sim.transpileCOS(testCode8);
console.log(`Input:  ${testCode8}`);
console.log(`Output: ${result8}`);
const pass8 = result8.includes('for (let j = 0; j <= 10; j += 2)');
console.log(pass8 ? '✅ PASS' : '❌ FAIL');

// Summary
console.log("\n" + "=".repeat(60));
const allPassed = pass2 && pass3 && pass4 && pass5 && pass6 && pass7 && pass8;
if (allPassed) {
  console.log("🎉 ALL TESTS PASSED!");
} else {
  console.log("⚠️  SOME TESTS FAILED!");
  console.log("Please check the output above for details.");
}
console.log("=".repeat(60));
