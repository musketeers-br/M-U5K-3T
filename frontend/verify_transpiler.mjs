import { Simulation } from './simulation.js';

console.log("============================================================");
console.log("🧪 TESTING REWRITTEN TRANSPILER");
console.log("============================================================");

// The Simulation object now has an internal runTests method.
// We can just invoke it.

async function run() {
  console.log("Triggering internal test suite...");
  try {
    const success = await Simulation.runTests();

    if (success) {
      console.log("\n✅ ALL INTERNAL TESTS PASSED");
    } else {
      console.log("\n❌ INTERNAL TESTS FAILED");
      process.exit(1);
    }
  } catch (e) {
    console.error("Test execution error:", e);
    process.exit(1);
  }
}

run();
