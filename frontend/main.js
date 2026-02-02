import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Simulation } from './simulation.js';

// --- VERSÃO DE DEBUG ---
console.log("🔹 FRONTEND BUILD: v3.3 - " + new Date().toISOString());
console.log("🔹 API TARGET: /mu5k3t/api");

// --- CONFIGURAÇÃO GLOBAL ---
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

// --- ESTADO DO JOGO ---
const gameState = {
  user: localStorage.getItem('musk_username'),
  currentMission: null,
  mode: 'SIMULATION', // 'SIMULATION' or 'DEPLOY'
  rover: null,
  isRunning: false
};

// --- ELEMENTOS DOM (Seleção Segura) ---
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

// ==========================================
// 🛠️ FUNÇÕES AUXILIARES DE AMBIENTE
// ==========================================

// Limpa objetos antigos da cena
const resetEnvironment = () => {
  console.log("🧹 Cleaning up environment...");
  const toRemove = [];
  scene.traverse((child) => {
    if (child.userData &&
      (child.userData.type === 'OBSTACLE' ||
        child.userData.type === 'MINERAL' ||
        child.userData.type === 'ROVER' ||
        child.userData.type === 'DECORATION')) {
      toRemove.push(child);
    }
  });
  toRemove.forEach(child => scene.remove(child));
};

// Busca dados do mapa no Backend
const fetchMapData = async (missionId, mode) => {
  const safeMode = mode === 'deploy' ? 'DEPLOY' : 'SIMULATION';
  // Caminho relativo para API
  const url = `${API_BASE_URL}/map/${missionId}/${safeMode}`;
  console.log(`📡 Fetching Map: ${url}`);

  const res = await fetch(url);
  const type = res.headers.get("content-type");

  // Validação contra erro de Proxy/HTML
  if (type && type.includes("text/html")) {
    throw new Error("Backend Error: Received HTML instead of JSON. Check API Path.");
  }
  if (!res.ok) throw new Error(`HTTP Error ${res.status}`);

  return await res.json();
};

// ==========================================
// 🌍 CORE: INICIALIZAÇÃO DO AMBIENTE (LOADER)
// ==========================================
async function initEnvironment(mode, missionId) {
  // 1. Mostrar Loader
  if (loaderElement) loaderElement.classList.remove('hidden');

  try {
    console.log(`🚀 Initializing: ${missionId} (${mode})`);
    gameState.mode = mode;
    gameState.currentMission = missionId;

    // 2. Limpar Cena
    resetEnvironment();

    // 3. Setup Loader com Caminho RELATIVO
    const loader = new GLTFLoader();
    loader.setPath('assets/'); // Crucial para texturas funcionarem no CSP

    // 4. Buscar Dados do Mapa + Assets 3D em Paralelo
    const [mapData, roverModel, landerModel] = await Promise.all([
      fetchMapData(missionId, mode),
      loader.loadAsync('dropship.gltf'),
      loader.loadAsync('lander_base.gltf')
    ]);

    // Calculate Dynamic Grid Scale
    const TILE_SIZE = 1.2;
    const gridSize = mapData.gridSize || 25;
    const worldSize = gridSize * TILE_SIZE;

    // 5. DANGER ROOM GRID (Dynamic Size)
    const gridHelper = new THREE.GridHelper(worldSize, gridSize, 0xff00ff, 0x2b0057);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Dark Floor underneath
    const planeGeo = new THREE.PlaneGeometry(worldSize, worldSize);
    const planeMat = new THREE.MeshBasicMaterial({ color: 0x0d001a, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(planeGeo, planeMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01; // Slightly below grid
    scene.add(floor);

    // Dynamic Camera Distance
    const camDist = Math.max(20, gridSize * 0.8);
    camera.position.set(camDist, camDist, camDist);
    camera.lookAt(0, 0, 0);

    // 6. Configurar Base Station
    const landerMesh = landerModel.scene;
    landerMesh.scale.set(3.5, 3.5, 3.5); // BIGGER
    landerMesh.position.set(0, 0, 0);    // ON GROUND
    scene.add(landerMesh);

    // 7. Configurar Rover (Now Dropship)
    const roverMesh = roverModel.scene;
    roverMesh.scale.set(0.8, 0.8, 0.8); // Fit in 1.2 tile
    roverMesh.position.set(0, 0.2, 0);   // Slight hover
    roverMesh.userData = { type: 'ROVER' };
    scene.add(roverMesh);
    gameState.rover = roverMesh; // Salva ref para o simulador

    // 8. OBSTACLES (Full Tile Blocks)
    if (mapData.obstacles) {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x505050,
        roughness: 0.2,
        metalness: 0.8
      });

      mapData.obstacles.forEach(obs => {
        const block = new THREE.Mesh(geo, mat);
        // Center on tile (assuming integer coords map to world units)
        block.position.set(obs.x, 0.5, obs.z);
        block.userData = { type: 'OBSTACLE' };

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
        crystal.position.set(min.x, 0.6, min.z); // Slightly floating
        crystal.userData = { type: 'MINERAL', value: min.value };
        scene.add(crystal);
      });
    }

    // 10. Inicializa o Cérebro do Simulador
    // Importante: Simulation.js precisa ter o método init() implementado
    if (Simulation.init) {
      Simulation.init(mapData, roverMesh, scene, updateHUD);
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

// ==========================================
// 🎮 CONTROLE DO JOGO
// ==========================================

// Função global exposta para o HTML/Botões
window.resetGame = async () => {
  Simulation.stop();
  await initEnvironment(gameState.mode, gameState.currentMission || 'M1');
};

// Função chamada pelos botões do Dashboard
window.loadMission = (id, mode) => {
  initEnvironment(mode, id);
};

// ==========================================
// 🖥️ UI & NAVEGAÇÃO
// ==========================================

const switchView = (viewId) => {
  document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(viewId);
  if (target) target.classList.remove('hidden');
};

const updateHUD = (data) => {
  try {
    const fuelEl = document.getElementById('fuel-display');
    if (fuelEl) fuelEl.innerText = Math.floor(data.fuel || 100) + '%';
  } catch (e) { }
};

// --- AUTH & DASHBOARD ---

const renderDashboard = async () => {
  if (!missionList) return;
  missionList.innerHTML = '<div class="loader-text">SYNCING MISSION DATA...</div>';

  try {
    const res = await fetch(`${API_BASE_URL}/dashboard/${gameState.user}`);
    const data = await res.json();

    missionList.innerHTML = ''; // Limpa loader

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

// ==========================================
// 📖 LÓGICA DO TUTORIAL (Carrossel Terminal)
// ==========================================
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
      // REMOVED: replace('<span class="cursor"></span>', '') - simplified cursor management

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


// ==========================================
// 🔌 EVENT LISTENERS
// ==========================================

const initBtn = document.getElementById('initialize-uplink-btn');
if (initBtn) initBtn.addEventListener('click', handleLogin);

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('musk_username');
  location.reload();
});

const rBtn = document.getElementById('reset-btn');
if (rBtn) rBtn.onclick = window.resetGame;

const execBtn = document.getElementById('execute-test-btn');
if (execBtn) execBtn.onclick = () => Simulation.runCode();

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