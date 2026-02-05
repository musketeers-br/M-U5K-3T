import { Simulation } from './simulation.js';

// Mock THREE.js Environment
const mockScene = {
  add: () => { },
  remove: () => { },
  traverse: () => { },
  children: []
};

// Mock Rover Mesh
const mockRover = {
  position: { set: () => { } },
  rotation: { y: 0 },
  userData: {},
  children: []
};

// Mock HUD
const mockHUD = () => { };

console.log("🚀 Starting Physics Verification...");

// Initialize Simulation with Mock Data
Simulation.init({
  gridSize: 10,
  minerals: [],
  obstacles: [],
  roverStart: { x: 0, z: 0 }
}, mockRover, mockScene, mockHUD);

// init calls runPhysicsTests automatically
