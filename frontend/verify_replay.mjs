import { Simulation } from './simulation.js';

// --- MOCKS ---
const mockScene = {
  add: () => { },
  remove: () => { },
  traverse: (cb) => {
    // Mock finding a mineral
    cb({
      userData: { type: 'MINERAL', x: 0, z: -1 },
      visible: true,
      position: { set: () => { } }
    });
  },
  children: []
};

const mockRover = {
  position: { set: (x, y, z) => { mockRover._x = x; mockRover._z = z; } },
  rotation: { y: 0 },
  userData: { flashDamage: () => { console.log("💥 FLASH DAMAGE"); } },
  children: []
};

let lastHudUpdate = null;
const mockHUD = (data) => {
  lastHudUpdate = data;
  // console.log("HUD UPDATE:", data);
};

// --- DATA ---
const serverMapData = {
  gridSize: 10,
  minerals: [{ x: 0, z: -1 }],
  obstacles: [],
  roverStart: { x: 0, z: 0 }
};

const timeline = [
  { roverState: { x: 0, z: 0, direction: 'north', fuel: 100, health: 100, score: 0 }, event: 'START' },
  { roverState: { x: 0, z: -1, direction: 'north', fuel: 99, health: 100, score: 0 }, event: 'MOVE' },
  { roverState: { x: 0, z: -1, direction: 'north', fuel: 98, health: 100, score: 50 }, event: 'COLLECT' }
];

// --- TEST EXECUTION ---
async function runTest() {
  console.log("🚀 Starting Replay Verification...");

  // Initialize
  Simulation.init(serverMapData, mockRover, mockScene, mockHUD);

  // Run Replay
  console.log("▶️ Calling runReplay...");
  Simulation.runReplay(timeline, serverMapData);

  // Wait for replay to finish (3 frames * 250ms = 750ms + buffer)
  setTimeout(() => {
    console.log("⏸️ Verifying Final State...");

    // 1. Check Rover Visual Position (World Coords)
    // gridToWorld(0, -1) -> (0 * 1.2) - offset, (-1 * 1.2) - offset
    // offset = (10 * 1.2)/2 - 0.6 = 6 - 0.6 = 5.4
    // z = -1.2 - 5.4 = -6.6
    // float precision might require tolerance
    // But we can check internal state of simulation? 
    // Simulation.runReplay updates visuals directly, not Simulation.state.memory (except mapData override)
    // So we check the mockRover positions.

    // Actually, let's just check the HUD update, which comes from the replay loop
    if (!lastHudUpdate) {
      console.error("❌ FAIL: No HUD update received.");
      process.exit(1);
    }

    const scoreMatch = lastHudUpdate.score === 50;
    const fuelMatch = lastHudUpdate.fuel === 98;

    if (scoreMatch && fuelMatch) {
      console.log("✅ Replay State Verified (Score: 50, Fuel: 98)");
      process.exit(0);
    } else {
      console.error(`❌ FAIL: State Mismatch. Expected Score 50, got ${lastHudUpdate.score}`);
      process.exit(1);
    }

  }, 1500);
}

runTest();
