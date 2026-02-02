import { Simulation } from './simulation.js';

const sim = new Simulation();

const testCases = [
  {
    name: "Basic Set",
    input: 'Set x = 1',
    expectedContent: ['var x = 1']
  },
  {
    name: "Abbreviated Set",
    input: 's y = 2',
    expectedContent: ['var y = 2']
  },
  {
    name: "String Literal with Keyword",
    input: 'Write "Set x=1"',
    expectedContent: ['roverApi.Write("Set x=1")']
  },
  {
    name: "Post-Conditional Set",
    input: 's:x=1 y=2',
    expectedContent: ['if (x == 1) { var y = 2; }', 'if (x == 1) { var y = 2 }'] // Allow slight variation
  },
  {
    name: "If Block",
    input: 'If x=1 { s y=2 }',
    expectedContent: ['if (x == 1) {', 'var y = 2']
  },
  {
    name: "Do Method",
    input: 'Do MyMethod()',
    expectedContent: ['MyMethod()']
  },
  {
    name: "Write Multiple",
    input: 'Write "A", "B"',
    expectedContent: ['roverApi.Write("A", "B")']
  },
  {
    name: "Post-Conditional Do",
    input: 'd:cond MyMethod()',
    expectedContent: ['if (cond) { MyMethod(); }']
  },
  {
    name: "Nested Object Literal",
    input: 'Do context.%Set("output", { "action": "COLLECT" })',
    expectedContent: ['context._Set("output", { "action": "COLLECT" })']
  },
  {
    name: "Escaped Quotes in String",
    input: 'Set json = "{ \\"key\\": \\"val\\" }"',
    expectedContent: ['var json = "{ \\"key\\": \\"val\\" }";']
  }
];

console.log("Starting Verification...\n");

let passed = 0;
for (const test of testCases) {
  console.log(`--- Test: ${test.name} ---`);
  const output = sim.transpileCOS(test.input).trim();

  const match = test.expectedContent.some(exp => output.includes(exp));
  if (match) {
    console.log("PASS");
    passed++;
  } else {
    console.error("FAIL");
    console.error("Input:", test.input);
    console.error("Expected to contain:", test.expectedContent);
    console.error("Actual:", output);
  }
  console.log("");
}

console.log(`Result: ${passed}/${testCases.length} Passed`);
if (passed === testCases.length) {
  console.log("ALL TESTS PASSED");
  process.exit(0);
} else {
  process.exit(1);
}
