import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Simulation } from './simulation.js';

// --- CONFIGURAÇÃO GLOBAL ---
const API_BASE_URL = "/mu5k3t/api";
// --- VERSÃO DE DEBUG ---
console.log("🔹 FRONTEND BUILD: v3.0 - " + new Date().toISOString());
console.log("🔹 API TARGET: /mu5k3t/api");

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
    // NOTA: Removemos a árvore quebrada da lista
    const [mapData, terrain, roverModel, landerModel] = await Promise.all([
      fetchMapData(missionId, mode),
      loader.loadAsync('terrain_low.gltf'),
      loader.loadAsync('spacetruck.gltf'),
      loader.loadAsync('lander_base.gltf')
    ]);

    // 5. Configurar Terreno
    const terrainMesh = terrain.scene;
    terrainMesh.position.set(12, -0.5, 12);
    terrainMesh.scale.set(1.5, 1, 1.5);
    scene.add(terrainMesh);

    // 6. Configurar Base Station
    const landerMesh = landerModel.scene;
    landerMesh.position.set(0, 0, 0);
    scene.add(landerMesh);

    // 7. Configurar Rover
    const roverMesh = roverModel.scene;
    roverMesh.userData = { type: 'ROVER' };
    scene.add(roverMesh);
    gameState.rover = roverMesh; // Salva ref para o simulador

    // 8. Popular Obstáculos (Map Data)
    if (mapData.obstacles) {
      // Geometria Fallback caso não tenhamos modelo de pedra
      const geo = new THREE.DodecahedronGeometry(0.4);
      const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8 });

      mapData.obstacles.forEach(obs => {
        const rock = new THREE.Mesh(geo, mat);
        rock.position.set(obs.x, 0.4, obs.z);
        rock.userData = { type: 'OBSTACLE' };
        scene.add(rock);
      });
    }

    // 9. Popular Minerais (Map Data)
    if (mapData.minerals) {
      const geo = new THREE.OctahedronGeometry(0.3);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, emissive: 0xaa4400 });

      mapData.minerals.forEach(min => {
        const crystal = new THREE.Mesh(geo, mat);
        crystal.position.set(min.x, 0.5, min.z);
        crystal.userData = { type: 'MINERAL', value: min.value };
        scene.add(crystal);
      });
    }

    // Inicializa sistema de simulação
    Simulation.init(mapData, roverMesh, scene, updateHUD);

    // Troca para visão do jogo
    switchView('game-view');

  } catch (error) {
    console.error("❌ CRITICAL INIT ERROR:", error);
    alert("Simulation Failed: " + error.message);
  } finally {
    // 10. ESCONDER LOADER (Sempre executa, mesmo com erro)
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
  // Atualiza interface durante o jogo (Score, Fuel, etc)
  // Implementação simples para evitar ReferenceError se elementos faltarem
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
        actionsHtml = `<button class="btn gray" disabled>🔒 LOCKED</button>`;
      } else if (mission.status === 'OPEN') {
        actionsHtml = `<button class="btn blue" onclick="window.loadMission('${mission.id}', 'SIMULATION')">🟢 START MISSION</button>`;
      } else if (mission.status === 'COMPLETED') {
        actionsHtml = `
                    <div class="mission-stats">
                        <span>🏆 BEST: ${mission.highScore}</span>
                        <span># RANK: ${mission.rank}</span>
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
    missionList.innerHTML = `<div class="error-msg">⚠ UPLINK FAILED<br>${e.message}</div>`;
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

    switchView('mission-hub');
    renderDashboard();

  } catch (error) {
    if (landingStatus) landingStatus.innerText = `Error: ${error.message}`;
  }
};

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
animate();

// Verifica sessão inicial
if (gameState.user) {
  switchView('mission-hub');
  renderDashboard();
} else {
  switchView('landing-view');
}
// ==========================================
// 🏁 INICIALIZAÇÃO (COLE NO FINAL DO ARQUIVO)
// ==========================================

// 2. Lógica de Inicialização
window.addEventListener('load', () => {
    console.log("🚦 Window Loaded. Checking Session...");
    
    // KILL SWITCH: Força o loader a sumir na marra
    const loader = document.getElementById('loader');
    if (loader) {
        console.log("🔓 Unlocking Interface...");
        loader.classList.add('hidden');
        loader.style.display = 'none'; // Garante via CSS inline também
    }

    // Verifica se já está logado
    if (gameState.user) {
        console.log(`👤 User found: ${gameState.user}. Redirecting to Hub.`);
        switchView('mission-hub');
        renderDashboard();
    } else {
        console.log("👤 No session. Showing Landing Page.");
        switchView('landing-view');
    }
});