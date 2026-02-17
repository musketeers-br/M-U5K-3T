import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Simulation } from './simulation.js';
import { MissionRenderer } from './MissionRenderer.js';

// --- VERSÃO DE DEBUG ---
console.log("🔹 FRONTEND BUILD: v4.4 - " + new Date().toISOString());
console.log("🔹 TRANSPILER BUILD: v4.1 - " + new Date().toISOString());
console.log("🔹 API TARGET: /mu5k3t/api");

const API_BASE_URL = "/mu5k3t/api";

const CONFIG = {
  colors: {
    background: 0x1a1025,
    ground: 0x4b3d5c,
    groundFlash: 0x6a4c82,
    obstacle: 0x888888,
    mineral: 0xffd700,
    roverBody: 0xffffff,
    roverWheel: 0x111111,
    baseStation: 0x4a9eff
  },
  grid: { size: 25, tileSize: 1.2, gap: 0.1 },
  camera: { viewSize: 18, panSpeed: 2 }
};

const gameState = {
  user: localStorage.getItem('musk_username'),
  currentMission: null,
  mode: 'SIMULATION', // 'SIMULATION' or 'DEPLOY'
  rover: null,
  isRunning: false
};

const loaderElement = document.getElementById('loader');
const landingStatus = document.getElementById('landing-status');
const usernameInput = document.getElementById('username-input');
const missionList = document.getElementById('mission-list');

// --- SETUP THREE.JS ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.colors.background);

const aspect = window.innerWidth / window.innerHeight;
const d = CONFIG.camera.viewSize;
const camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
camera.position.set(20, 20, 20);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

// Adiciona ao DOM
const gameView = document.getElementById('game-view');
if (gameView) gameView.appendChild(renderer.domElement);
else document.body.appendChild(renderer.domElement);

// Luzes
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

const resetEnvironment = () => {
  console.log("🧹 Cleaning up environment...");
  const toRemove = [];
  scene.traverse((child) => {
    // 1. Safe extraction of type (default to null if missing)
    const type = (child.userData && child.userData.type) ? child.userData.type : null;

    // 2. Check strictly against known types
    if (type && (
      type === 'OBSTACLE' ||
      type === 'MINERAL' ||
      type === 'ROVER' ||
      type === 'DECORATION' ||
      type.startsWith('SENSOR') // Now safe because type is guaranteed to be a truthy string
    )) {
      toRemove.push(child);
    }
  });
  toRemove.forEach(child => scene.remove(child));
};

const fetchMapData = async (missionId, mode) => {
  console.log(`📡 ESTABLISHING UPLINK: Fetching ${missionId} (${mode})...`);

  try {
    const safeMode = mode === 'deploy' ? 'DEPLOY' : 'SIMULATION';
    const res = await fetch(`${API_BASE_URL}/map/${missionId}/${safeMode}`);
    if (!res.ok) throw new Error(`Map Uplink Failed: ${res.statusText}`);

    const data = await res.json();

    // 🛡️ DATA INTEGRITY CHECK (Unit Test Pattern)
    if (!data.gridSize) console.warn("⚠️ Map missing gridSize, defaulting to 25.");
    if (!Array.isArray(data.minerals)) data.minerals = [];
    if (!Array.isArray(data.obstacles)) data.obstacles = [];

    // Force Types to guarantee Physics Engine compatibility (Twin World prevention)
    if (data.minerals) data.minerals.forEach(m => { m.x = Number(m.x); m.z = Number(m.z); });
    if (data.obstacles) data.obstacles.forEach(o => { o.x = Number(o.x); o.z = Number(o.z); });
    if (data.roverStart) { data.roverStart.x = Number(data.roverStart.x); data.roverStart.z = Number(data.roverStart.z); }

    console.log(`✅ MAP DATA SECURED. Minerals: ${data.minerals.length}, Obstacles: ${data.obstacles.length}`);
    return data;

  } catch (error) {
    console.error("❌ UPLINK SEVERED:", error);
    // Explicitly fail to prevent silent sync errors
    throw error;
  }
};

async function initEnvironment(mode, missionId) {
  // 1. Mostrar Loader
  if (loaderElement) loaderElement.classList.remove('hidden');

  try {
    console.log(`🚀 Initializing: ${missionId} (${mode})`);
    gameState.mode = mode;
    gameState.currentMission = missionId;

    resetEnvironment();

    const loader = new GLTFLoader();
    loader.setPath('assets/'); 

    const [mapData, roverModel, landerModel] = await Promise.all([
      fetchMapData(missionId, mode),
      loader.loadAsync('dropship.gltf'),
      loader.loadAsync('lander_base.gltf')
    ]);

    // Calculate Dynamic Grid Scale
    const TILE_SIZE = 1.2;
    const gridSize = mapData.gridSize || 25;
    const worldSize = gridSize * TILE_SIZE;
    const centerOffset = worldSize / 2 - (TILE_SIZE / 2);

    // Helper function to convert logical grid coordinates to world coordinates
    const offset = (gridSize * 1.2) / 2 - 0.6; // 0.6 is half tile
    const gridToWorld = (x, z) => ({
      x: (x * 1.2) - offset,
      z: (z * 1.2) - offset
    });

    // 5. DANGER ROOM GRID (Dynamic Size) - High Contrast Colors
    const gridHelper = new THREE.GridHelper(worldSize, gridSize, 0x00FFFF, 0x9966CC);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Dark Floor underneath
    const planeGeo = new THREE.PlaneGeometry(worldSize, worldSize);
    const planeMat = new THREE.MeshBasicMaterial({ color: 0x150a20, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(planeGeo, planeMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01; // Slightly below grid
    scene.add(floor);

    // Dynamic Camera Zoom - Position camera to view entire grid
    const viewSize = Math.max(15, worldSize * 0.8);

    // Update Camera
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -viewSize * aspect;
    camera.right = viewSize * aspect;
    camera.top = viewSize;
    camera.bottom = -viewSize;
    camera.zoom = 1; // Reset zoom
    camera.updateProjectionMatrix();

    // Position camera at proper angle looking at center of the board
    camera.position.set(centerOffset * 1.5, worldSize * 0.8, centerOffset * 1.5);
    camera.lookAt(0, 0, 0); // Look at world center (middle of grid)

    // 6. Configurar Base Station
    const landerMesh = landerModel.scene;
    landerMesh.scale.set(0.8, 0.8, 0.8); // Fit in single tile (1.2 units)
    // Center at (0,0) with proper grid alignment
    const baseStation = mapData.baseStation || { x: 0, z: 0 };
    const basePos = gridToWorld(baseStation.x, baseStation.z);
    landerMesh.position.set(basePos.x, 0, basePos.z);
    scene.add(landerMesh);

    // 6.1 Add Fuel Zone Visual Indicator (Green Glow at Base Station)
    const fuelZoneGeo = new THREE.PlaneGeometry(TILE_SIZE * 0.95, TILE_SIZE * 0.95);
    const fuelZoneMat = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    });
    const fuelZone = new THREE.Mesh(fuelZoneGeo, fuelZoneMat);
    fuelZone.rotation.x = -Math.PI / 2;
    fuelZone.position.set(basePos.x, 0.01, basePos.z);
    fuelZone.userData = { type: 'FUEL_ZONE' };
    scene.add(fuelZone);

    // 7. Configurar Rover (Now Dropship)
    const roverMesh = roverModel.scene;
    roverMesh.scale.set(0.8, 0.8, 0.8); // Fit in 1.2 tile
    const roverStart = mapData.roverStart || { x: 0, z: 0 };
    const roverPos = gridToWorld(roverStart.x, roverStart.z);
    roverMesh.position.set(roverPos.x, 0.2, roverPos.z); // Slight hover
    roverMesh.userData = {
      type: 'ROVER',
      originalColor: 0xffffff,
      flashDamage: function () {
        const original = this.originalColor || 0xffffff;
        roverMesh.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material.color.setHex(0xff0000); // Flash Red
            setTimeout(() => {
              child.material.color.setHex(original); // Restore
            }, 200);
          }
        });
      }
    };
    scene.add(roverMesh);
    gameState.rover = roverMesh; 

    // 8. OBSTACLES (Full Tile Blocks)
    if (mapData.obstacles) {
      const geo = new THREE.BoxGeometry(TILE_SIZE, 1, TILE_SIZE);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x505050,
        roughness: 0.2,
        metalness: 0.8
      });

      mapData.obstacles.forEach(obs => {
        const block = new THREE.Mesh(geo, mat);
        // Convert logical grid coordinates to world coordinates
        const pos = gridToWorld(obs.x, obs.z);
        block.position.set(pos.x, 0.5, pos.z);
        block.userData = { type: 'OBSTACLE', x: obs.x, z: obs.z };

        // Add Neon Edges for style
        const edges = new THREE.EdgesGeometry(geo);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff00ff }));
        block.add(line);

        scene.add(block);
      });
    }

    // 9. MINERALS (Large Floating Crystals)
    if (mapData.minerals) {
      const geo = new THREE.OctahedronGeometry(0.5); // Diameter 1.0
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xaa4400,
        emissiveIntensity: 0.5,
        metalness: 1.0
      });

      mapData.minerals.forEach(min => {
        const crystal = new THREE.Mesh(geo, mat);
        // Convert logical grid coordinates to world coordinates
        const pos = gridToWorld(min.x, min.z);
        crystal.position.set(pos.x, 0.6, pos.z); // Slightly floating
        crystal.userData = { type: 'MINERAL', value: min.value, x: min.x, z: min.z };
        scene.add(crystal);
      });
    }

    // 10. Sensor Visualization (Multiple Tile Sensors)
    const sensorMeshes = {};
    const sensorGeo = new THREE.PlaneGeometry(TILE_SIZE * 0.9, TILE_SIZE * 0.9);

    // Sensor 1: Front (Yellow)
    const frontMat = new THREE.MeshBasicMaterial({
      color: 0xFFEA00, // Safety Yellow for High Visibility
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthTest: true
    });
    sensorMeshes.front = new THREE.Mesh(sensorGeo, frontMat);
    sensorMeshes.front.renderOrder = 1;
    sensorMeshes.front.rotation.x = -Math.PI / 2;
    sensorMeshes.front.position.y = 0.05;
    sensorMeshes.front.visible = false;
    sensorMeshes.front.userData = { type: 'SENSOR_FRONT' };
    scene.add(sensorMeshes.front);

    // Sensor 2: Front Far (Orange)
    const farMat = new THREE.MeshBasicMaterial({
      color: 0xFFA500,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthTest: true
    });
    sensorMeshes.far = new THREE.Mesh(sensorGeo, farMat);
    sensorMeshes.far.renderOrder = 1;
    sensorMeshes.far.rotation.x = -Math.PI / 2;
    sensorMeshes.far.position.y = 0.05;
    sensorMeshes.far.visible = false;
    sensorMeshes.far.userData = { type: 'SENSOR_FAR' };
    scene.add(sensorMeshes.far);

    // Sensor 3: Left (Cyan)
    const leftMat = new THREE.MeshBasicMaterial({
      color: 0x00FFFF,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthTest: true
    });
    sensorMeshes.left = new THREE.Mesh(sensorGeo, leftMat);
    sensorMeshes.left.renderOrder = 1;
    sensorMeshes.left.rotation.x = -Math.PI / 2;
    sensorMeshes.left.position.y = 0.05;
    sensorMeshes.left.visible = false;
    sensorMeshes.left.userData = { type: 'SENSOR_LEFT' };
    scene.add(sensorMeshes.left);

    // Sensor 4: Right (Cyan)
    sensorMeshes.right = new THREE.Mesh(sensorGeo, leftMat.clone()); // CLONE MATERIAL
    sensorMeshes.right.renderOrder = 1;
    sensorMeshes.right.rotation.x = -Math.PI / 2;
    sensorMeshes.right.position.y = 0.05;
    sensorMeshes.right.visible = false;
    sensorMeshes.right.userData = { type: 'SENSOR_RIGHT' };
    scene.add(sensorMeshes.right);

    if (Simulation.init) {
      Simulation.init(mapData, roverMesh, scene, updateHUD, sensorMeshes);
    } else {
      console.error("⚠ Simulation.init missing! Check simulation.js");
    }

    // Troca para visão do jogo
    switchView('game-view');

  } catch (error) {
    console.error("CRITICAL INIT ERROR:", error);
    alert("Simulation Failed: " + error.message);
  } finally {
    // 11. ESCONDER LOADER (Sempre executa, mesmo com erro)
    if (loaderElement) loaderElement.classList.add('hidden');
  }
}

// Cleanup function to properly reset simulation state
const cleanupSimulation = () => {
  console.log("🧹 Cleaning up simulation...");

  // Stop any running simulation
  if (Simulation && Simulation.stop) {
    Simulation.stop();
  }

  // Clear the scene but keep essential objects
  const essentialObjects = [];
  scene.traverse((child) => {
    // Keep lights, camera, and renderer
    if (child.type === 'AmbientLight' ||
      child.type === 'DirectionalLight' ||
      child === camera ||
      child === renderer) {
      essentialObjects.push(child);
    }
  });

  // Remove all children
  while (scene.children.length > 0) {
    scene.remove(scene.children[0]);
  }

  // Re-add essential objects
  essentialObjects.forEach(obj => scene.add(obj));

  // Reset game state
  gameState.rover = null;
  gameState.isRunning = false;

  console.log("✅ Simulation cleaned up");
};

// Global reset function
window.resetGame = async () => {
  cleanupSimulation();

  // Clear modal and state
  const goScreen = document.getElementById('game-over-screen');
  if (goScreen) goScreen.classList.add('hidden');
  gameState.isGameOver = false;

  await initEnvironment(gameState.mode, gameState.currentMission || 'M1');
};

// Back to Dashboard function
window.backToDashboard = () => {
  cleanupSimulation();
  switchView('mission-hub');
  if (typeof renderDashboard === 'function') {
    renderDashboard();
  }
};

// Função chamada pelos botões do Dashboard
window.loadMission = (id, mode) => {
  initEnvironment(mode, id);
};

const switchView = (viewId) => {
  document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(viewId);
  if (target) {
    target.classList.remove('hidden');
    // If switching to mission-view, ensure renderer resizes
    if (viewId === 'mission-view' && window.missionRenderer) {
      setTimeout(() => window.missionRenderer.resize(), 100);
    }
  }
};

const updateHUD = (data) => {
  try {
    // Check Game Over Conditions
    if ((data.health <= 0 || data.fuel <= 0) && !gameState.isGameOver) {
      gameState.isGameOver = true;
      const gameOverScreen = document.getElementById('game-over-screen');
      const reasonEl = document.getElementById('game-over-reason');

      if (gameOverScreen) gameOverScreen.classList.remove('hidden');
      if (reasonEl) reasonEl.innerText = data.health <= 0 ? "HULL BREACH" : "FUEL DEPLETED";

      // Stop Simulation
      if (typeof Simulation !== 'undefined' && Simulation.stop) Simulation.stop();
    }

    // Update Fuel
    const fuelEl = document.getElementById('fuel-display');
    if (fuelEl) fuelEl.innerText = Math.floor(data.fuel || 0); // Default to 0 if undefined

    // Update HP with color coding
    const hpEl = document.getElementById('hp-display');
    if (hpEl) {
      const hp = Math.floor(data.health || 0); // Default to 0
      hpEl.innerText = hp;
      if (hp <= 30) {
        hpEl.style.color = '#ff4d4d';
      } else if (hp <= 60) {
        hpEl.style.color = '#ff9e00';
      } else {
        hpEl.style.color = '#00ff00';
      }
    }

    // Update Score
    const scoreEl = document.getElementById('score-display');
    if (scoreEl) scoreEl.innerText = data.score || 0;

    // Update Steps
    const stepsEl = document.getElementById('steps-display');
    if (stepsEl) stepsEl.innerText = data.steps || 0;

    // Update Status
    const statusEl = document.getElementById('status-display');
    if (statusEl) statusEl.innerText = data.status || "OFFLINE";
  } catch (e) {
    console.error("HUD Update Error:", e);
  }
};

// --- AUTH & DASHBOARD ---

const renderDashboard = async () => {
  if (!missionList) return;
  missionList.innerHTML = '<div class="loader-text">SYNCING MISSION DATA...</div>';

  try {
    const res = await fetch(`${API_BASE_URL}/dashboard/${gameState.user}`);
    const data = await res.json();

    missionList.innerHTML = ''; // Limpa loader

    // DEFENSIVE CHECK
    if (!data.missions || !Array.isArray(data.missions)) {
      console.warn("Dashboard: No missions data received.", data);
      missionList.innerHTML = '<div class="error-msg">NO MISSION DATA RECEIVED</div>';
      return;
    }

    data.missions.forEach(mission => {
      const card = document.createElement('div');
      card.className = `mission-card ${mission.status.toLowerCase()}`;

      let actionsHtml = '';
      if (mission.status === 'LOCKED') {
        actionsHtml = `<button class="btn gray" disabled><span class="status-dot red"></span>LOCKED</button>`;
      } else if (mission.status === 'OPEN') {
        actionsHtml = `<button class="btn blue" onclick="window.loadMission('${mission.id}', 'SIMULATION')"><span class="status-dot green"></span>START MISSION</button>`;
      } else if (mission.status === 'COMPLETED') {
        actionsHtml = `
                    <div class="mission-stats">
                        <span>BEST SCORE: ${mission.highScore}</span>
                        <span>RANK: ${mission.rank}</span>
                    </div>
                    <div class="btn-group">
                        <button class="btn orange small" onclick="window.loadMission('${mission.id}', 'DEPLOY')">WATCH ORBIT</button>
                        <button class="btn blue outline small" onclick="window.loadMission('${mission.id}', 'SIMULATION')">OPTIMIZE</button>
                    </div>
                `;
      }

      card.innerHTML = `
                <div class="card-header"><h3>${mission.name}</h3></div>
                <p class="mission-desc">${mission.description}</p>
                <div class="card-footer">${actionsHtml}</div>
            `;
      missionList.appendChild(card);
    });

  } catch (e) {
    console.error("Dashboard Error:", e);
    missionList.innerHTML = `<div class="error-msg">(!) UPLINK FAILED<br>${e.message}</div>`;
  }
};

const handleLogin = async () => {
  const username = usernameInput.value.trim();
  if (username.length <= 3) return;

  try {
    if (landingStatus) {
      landingStatus.innerText = "Connecting...";
      landingStatus.classList.remove('hidden');
    }

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    localStorage.setItem('musk_username', data.username);
    gameState.user = data.username;

    // --- LOGIC: ONBOARDING CHECK ---
    const skip = localStorage.getItem('musk_skip_tutorial');

    if (skip === 'true') {
      console.log("⏩ Skipping Tutorial (User Preference)");
      switchView('mission-hub');
      renderDashboard();
    } else {
      console.log("📖 Showing Onboarding...");
      switchView('tutorial-view');
      // Inicializa UI do tutorial
      if (typeof updateTutorialUI === 'function') updateTutorialUI();
    }

  } catch (error) {
    if (landingStatus) landingStatus.innerText = `Error: ${error.message}`;
  }
};

const tutorialSlidesData = document.querySelectorAll('#tutorial-slides-data .tutorial-step');
const tutorialConsole = document.getElementById('typewriter-target');
const nextBtn = document.getElementById('tutorial-next-btn');
const prevBtn = document.getElementById('tutorial-prev-btn');
const finishBtnContainer = document.getElementById('enter-control-btn');
const skipCheck = document.getElementById('skip-tutorial-check');

let currentStep = 0;
let isTyping = false;
let typeTimeout = null;

/**
 * Efeito de máquina de escrever retrô
 */
const typeWriter = (element, html, speed = 15) => {
  return new Promise((resolve) => {
    isTyping = true;
    element.innerHTML = '';

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const nodes = Array.from(tempDiv.childNodes);

    let nodeIndex = 0;

    const typeNode = () => {
      if (nodeIndex >= nodes.length) {
        if (!element.querySelector('.cursor')) {
          element.innerHTML += '<span class="cursor"></span>';
        }
        isTyping = false;
        resolve();
        return;
      }

      const node = nodes[nodeIndex];
      const playSound = () => {
        // [PLACEHOLDER] keystroke sound
        // console.log("🔊 TICK"); 
      };

      if (node.nodeType === Node.TEXT_NODE) {
        let charIndex = 0;
        const text = node.textContent;
        const typeChar = () => {
          if (charIndex < text.length) {
            const cursor = element.querySelector('.cursor');
            if (cursor) cursor.remove();

            element.innerHTML += text[charIndex] + '<span class="cursor"></span>';
            charIndex++;
            playSound();
            typeTimeout = setTimeout(typeChar, speed);
          } else {
            nodeIndex++;
            typeNode();
          }
        };
        typeChar();
      } else {
        const wrapper = node.cloneNode(false);
        const cursor = element.querySelector('.cursor');
        if (cursor) cursor.remove();

        element.appendChild(wrapper);
        wrapper.innerHTML += '<span class="cursor"></span>';

        const innerText = node.textContent;
        let charIndex = 0;
        const typeInnerChar = () => {
          if (charIndex < innerText.length) {
            const innerCursor = wrapper.querySelector('.cursor');
            if (innerCursor) innerCursor.remove();

            wrapper.textContent += innerText[charIndex];
            wrapper.innerHTML += '<span class="cursor"></span>';
            charIndex++;
            playSound();
            typeTimeout = setTimeout(typeInnerChar, speed);
          } else {
            nodeIndex++;
            typeNode();
          }
        };
        typeInnerChar();
      }
    };

    typeNode();
  });
};

const updateTutorialUI = async () => {
  if (!tutorialSlidesData.length || !tutorialConsole) return;

  // Cancela digitação anterior se houver
  if (typeTimeout) clearTimeout(typeTimeout);

  const stepData = tutorialSlidesData[currentStep];
  const htmlContent = stepData.innerHTML;

  // 1. Inicia Digitação
  await typeWriter(tutorialConsole, htmlContent);

  // 2. Atualiza Botões (somente após terminar de digitar ou durante se quiser permitir pular)
  if (prevBtn) prevBtn.disabled = (currentStep === 0);

  if (currentStep === tutorialSlidesData.length - 1) {
    if (nextBtn) nextBtn.style.display = 'none';
    if (finishBtnContainer) {
      finishBtnContainer.classList.remove('hidden');
      finishBtnContainer.style.display = 'inline-block';
    }
  } else {
    if (nextBtn) nextBtn.style.display = 'inline-block';
    if (finishBtnContainer) {
      finishBtnContainer.classList.add('hidden');
      finishBtnContainer.style.display = 'none';
    }
  }
};

if (nextBtn && prevBtn) {
  nextBtn.onclick = () => {
    if (isTyping) return; // Opcional: permitir pular?
    if (currentStep < tutorialSlidesData.length - 1) {
      currentStep++;
      updateTutorialUI();
    }
  };

  prevBtn.onclick = () => {
    if (isTyping) return;
    if (currentStep > 0) {
      currentStep--;
      updateTutorialUI();
    }
  };
}

// Botão FINAL "Initialize Control Link"
if (finishBtnContainer) {
  finishBtnContainer.onclick = () => {
    // Salva preferência
    if (skipCheck && skipCheck.checked) {
      localStorage.setItem('musk_skip_tutorial', 'true');
    } else {
      localStorage.removeItem('musk_skip_tutorial');
    }
    // Vai para o jogo
    switchView('mission-hub');
    renderDashboard();
  };
}

let cmEditor = null;

// ==========================================
// 🔌 EVENT LISTENERS
// ==========================================
window.addEventListener('load', () => {
  console.log("🚦 System Ready.");
  if (loaderElement) loaderElement.classList.add('hidden');

  // --- INIT CODEMIRROR ---
  const textArea = document.getElementById('code-editor');
  if (textArea) {
    // @ts-ignore
    cmEditor = CodeMirror.fromTextArea(textArea, {
      mode: 'vb', // Visual Basic mode looks closest to ObjectScript
      theme: 'dracula',
      lineNumbers: true,
      autoCloseBrackets: true,
      styleActiveLine: true,
      indentUnit: 4,
      tabSize: 4,
      indentWithTabs: false
    });
    
    // Ajuste de altura para caber no container flex
    cmEditor.setSize("100%", "100%"); 
  }

  if (gameState.user) {
    switchView('mission-hub');
    renderDashboard();
  } else {
    switchView('landing-view');
  }
});


const initBtn = document.getElementById('initialize-uplink-btn');
if (initBtn) initBtn.addEventListener('click', handleLogin);

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('musk_username');
  location.reload();
});

const rBtn = document.getElementById('reset-btn');
if (rBtn) rBtn.onclick = window.resetGame;

const backBtn = document.getElementById('back-to-hub-btn');
if (backBtn) backBtn.onclick = window.backToDashboard;

const termToggle = document.getElementById('toggle-terminal');
const termEl = document.getElementById('terminal');
if (termToggle && termEl) {
  termToggle.onclick = () => {
    termEl.classList.toggle('collapsed');
    termToggle.innerText = termEl.classList.contains('collapsed') ? '<' : '>';
  };
}

const exportBtn = document.getElementById('btn-export');
if (exportBtn) {
  exportBtn.onclick = () => {
    const code = cmEditor ? cmEditor.getValue() : document.getElementById('code-editor').value;
    const blob = new Blob([code], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'MissionControl.cls';
    a.click();
  };
}

const expandBtn = document.getElementById('btn-expand');
if (expandBtn) {
  expandBtn.onclick = () => {
    const term = document.getElementById('terminal');
    term.classList.toggle('expanded');
    
    const isExpanded = term.classList.contains('expanded');
    expandBtn.innerText = isExpanded ? '[MIN]' : '[MAX]';
    
    if (cmEditor) {
        setTimeout(() => cmEditor.refresh(), 50);
    }
  };
}

const retryBtn = document.getElementById('retry-btn');
if (retryBtn) retryBtn.onclick = window.resetGame;

const execBtn = document.getElementById('execute-test-btn');
if (execBtn) execBtn.onclick = () => {
  const code = cmEditor ? cmEditor.getValue() : document.getElementById('code-editor').value;
  Simulation.runCode(code);
};

// ==========================================
// 🚀 DEPLOY BUTTON LOGIC
// ==========================================
const deployBtn = document.getElementById('deploy-orbit-btn');
const transmissionOverlay = document.getElementById('transmission-overlay');

if (deployBtn) {
  deployBtn.addEventListener('click', async () => {
    // 1. Validation
    const code = cmEditor ? cmEditor.getValue() : document.getElementById('code-editor').value;
    if (!code.trim()) { alert("Cannot deploy empty code!"); return; }
    if (!gameState.user) { alert("Pilot identity unknown. Please re-login."); return; }

    // 2. Show Overlay
    if (transmissionOverlay) {
      transmissionOverlay.classList.remove('hidden');
      // Reset animation or text if needed
      const p = transmissionOverlay.querySelector('p');
      if (p) p.innerText = "Transmitting to M-USK-3T...";
    }

    try {
      console.log(`📡 UPLINKING CODE FOR ${gameState.user} ON ${gameState.currentMission || 'M1'}`);

      // 3. API Call
      const response = await fetch(`${API_BASE_URL}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: gameState.user,
          missionId: gameState.currentMission || 'M1',
          code: code
        })
      });

      const rawText = await response.text();
      console.log("🔥 DEBUG - RAW BACKEND RESPONSE:", rawText);

      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        throw new Error("Invalid JSON from server: " + rawText.substring(0, 50));
      }

      // 4. Handle Response
      if (['COMPILE_ERROR', 'RUNTIME_ERROR', 'SECURITY_VIOLATION'].includes(data.status)) {
        const msg = `❌ ${data.status}: ${data.message || data.error || 'Unknown Error'}`;
        console.error(msg);
        alert(msg);
        if (transmissionOverlay) transmissionOverlay.classList.add('hidden');
        return;
      }

      if (!response.ok || data.error) {
        throw new Error(data.error || "Transmission rejected by satellite.");
      }

      console.log("✅ DEPLOY SUCCESS. REPLAYING TIMELINE...", data);

      // Hide Overlay after a brief delay for effect
      setTimeout(() => {
        if (transmissionOverlay) transmissionOverlay.classList.add('hidden');

        // Switch Mode to DEPLOY (if not already)
        gameState.mode = 'DEPLOY';

        // Start Replay
        // Ensure we have the map data used by the server (data.mapUsed)
        if (data.timeline && data.mapUsed) {

          // 1. SWAP VIEWS (Explicit Visibility Protocol)
          document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
          const missionView = document.getElementById('mission-view');
          if (missionView) {
            missionView.classList.remove('hidden');
            missionView.style.display = 'block'; // Force display
          }

          // 2. INIT RENDERER (Singleton)
          if (!window.missionRenderer) {
            window.missionRenderer = new MissionRenderer('mission-view');
          }
          window.missionRenderer.resize(); // Garante tamanho
          window.missionRenderer.loadMap(data.mapUsed);

    Simulation.runReplay(data.timeline, data.mapUsed, (step) => {
      const state = step.roverState;
      
      if (window.missionRenderer && state) {
          // PROTEÇÃO: Se direction vier undefined, usa 'north' para não quebrar o toLowerCase()
          const safeDirection = state.direction || 'north';
          
          window.missionRenderer.updateRover(state.x, state.z, safeDirection);

          if (step.event === 'COLLECT') {
              window.missionRenderer.hideMineral(state.x, state.z);
          }
      }
    });

        } else {
          alert("Error: Missing replay data from server.");
        }

      }, 1500);

    } catch (e) {
      console.error("❌ DEPLOY ERROR:", e);
      if (transmissionOverlay) {
        const p = transmissionOverlay.querySelector('p');
        if (p) {
          p.innerText = "TRANSMISSION FAILED.";
          p.style.color = "red";
        }
        setTimeout(() => {
          transmissionOverlay.classList.add('hidden');
          alert(`DEPLOY FAILED: ${e.message}`);
          // Penalize? (Optional)
        }, 2000);
      } else {
        alert(`DEPLOY FAILED: ${e.message}`);
      }
    }
  });
}

// ==========================================
// 🔄 ANIMATION LOOP
// ==========================================
function animate() {
  requestAnimationFrame(animate);

  // Suavização simples da câmera
  camera.position.lerp(new THREE.Vector3(20, 20, 20), 0.05);
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}


// ==========================================
// 🏁 INICIALIZAÇÃO E KILL SWITCH
// ==========================================

// Inicia o Loop Visual
animate();

window.addEventListener('load', () => {
  console.log("🚦 Window Loaded. System Check...");

  // KILL SWITCH: Força o loader a sumir na marra
  const loader = document.getElementById('loader');
  if (loader) {
    console.log("🔓 Unlocking Interface...");
    loader.classList.add('hidden');
    loader.style.display = 'none';
  }

  // Lógica de Sessão Inicial
  if (gameState.user) {
    console.log(`👤 User found: ${gameState.user}. Redirecting to Hub.`);
    switchView('mission-hub');
    renderDashboard();
  } else {
    console.log("👤 No session. Showing Landing Page.");
    switchView('landing-view');
  }

  // Inicializa Tutorial UI se estivermos na view de tutorial (caso de recarregamento raro)
  updateTutorialUI();
});
