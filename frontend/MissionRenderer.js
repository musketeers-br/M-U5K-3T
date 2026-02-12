import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class MissionRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`❌ MissionRenderer: Container #${containerId} not found`);
      return;
    }

    console.log("🪐 MissionRenderer build 5.0 (Clear View)");

    // --- CSS ENFORCEMENT ---
    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100vw';
    this.container.style.height = '100vh';
    this.container.style.zIndex = '9999';
    this.container.style.background = '#000000';
    this.container.style.display = 'block';

    // --- DEBUG OVERLAY ---
    this.debugDiv = document.createElement('div');
    Object.assign(this.debugDiv.style, {
      position: 'absolute', top: '10px', left: '10px',
      color: '#00FF00', fontSize: '16px', fontFamily: 'monospace',
      zIndex: '10000', pointerEvents: 'none'
    });
    this.debugDiv.innerText = "🛑 SYSTEM INITIALIZING...";
    this.container.appendChild(this.debugDiv);

    this.initScene();

    this.tileSize = 1.2;
    this.offset = 0;
    this.rover = null;
    this.crystals = [];
    this.assets = null;

    window.addEventListener('resize', () => this.resize());
    this.animate();
  }

  /**
   * Initializes Scene with CORRECT FOG and LIGHTING
   */
  initScene() {
    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8B4513); // Martian Rust

    // --- FIX: NEVOEIRO AJUSTADO ---
    // Antes: 20, 100 (Muito denso)
    // Agora: 90, 300 (Começa APÓS o centro do mapa)
    this.scene.fog = new THREE.Fog(0x8B4513, 90, 300);

    // 2. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.innerHTML = ''; 
    this.container.appendChild(this.renderer.domElement);
    this.container.appendChild(this.debugDiv);

    // 3. Camera
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const aspect = w / h;
    const viewSize = 40; 

    this.camera = new THREE.OrthographicCamera(
      -viewSize * aspect, viewSize * aspect,
      viewSize, -viewSize,
      -100, 1000
    );
    
    // Posição distante para isometria
    this.camera.position.set(50, 50, 50);
    this.camera.lookAt(0, 0, 0);

    // 4. Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2); 
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(50, 80, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.left = -50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = -50;
    this.scene.add(dirLight);

    // 5. Helpers (Eixos para referência)
    const axes = new THREE.AxesHelper(5);
    this.scene.add(axes);
  }

  normalizeAsset(model, targetSize) {
    if (!model) return new THREE.Object3D();
    const wrapper = new THREE.Group();
    const clone = model.clone();
    clone.position.set(0, 0, 0);
    clone.scale.set(1, 1, 1);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = (maxDim > 0) ? (targetSize / maxDim) : 1;
    clone.scale.set(scale, scale, scale);
    const yOffset = -box.min.y * scale;
    const xOffset = -(box.min.x + size.x / 2) * scale;
    const zOffset = -(box.min.z + size.z / 2) * scale;
    clone.position.set(xOffset, yOffset, zOffset);
    clone.traverse(c => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    wrapper.add(clone);
    return wrapper;
  }

  async preloadAssets() {
    if (this.assets) return this.assets;
    const loader = new GLTFLoader();
    const basePath = './assets/'; 
    console.log(`🪐 Loading assets from: ${basePath}`);
    this.debugDiv.innerText = "⏳ LOADING ASSETS...";

    const load = (file) => new Promise(resolve => {
      loader.load(basePath + file,
        (gltf) => {
          console.log(`✅ Loaded: ${file}`);
          resolve(gltf.scene);
        },
        undefined,
        (err) => {
          console.warn(`❌ Failed to load ${file}:`, err);
          resolve(null);
        }
      );
    });

    const timeout = new Promise(r => setTimeout(() => r('TIMEOUT'), 3000));
    const loadTask = Promise.all([
      load('terrain_low.gltf'),
      load('Rock_1_A_Color1.gltf'),
      load('Tree_Bare_1_B_Color1.gltf')
    ]).then(results => {
      return {
        terrain: results[0],
        rocks: results[1] ? [results[1]] : [],
        trees: results[2] ? [results[2]] : []
      };
    });

    const result = await Promise.race([loadTask, timeout]);

    if (result === 'TIMEOUT') {
      console.error("⏰ Asset Loading Timed Out. Using Fallbacks.");
      this.debugDiv.innerText = "⚠️ ASSET TIMEOUT";
      this.assets = { terrain: null, rocks: [], trees: [] };
    } else {
      this.assets = result;
      this.debugDiv.innerText = "✅ ASSETS READY";
    }
    setTimeout(() => { this.debugDiv.style.display = 'none'; }, 1000);
    return this.assets;
  }

  async loadMap(mapData) {
    if (!mapData) return;
    console.log("🗺️ Building Map...", mapData);
    if (!this.assets) await this.preloadAssets();

    const toRemove = [];
    this.scene.traverse(c => {
      if (c.userData.isLevelItem) toRemove.push(c);
    });
    toRemove.forEach(c => this.scene.remove(c));
    this.crystals = [];

    const gridSize = mapData.gridSize || 25;
    this.offset = (gridSize * this.tileSize) / 2 - (this.tileSize / 2);

    // TERRAIN
    if (this.assets.terrain) {
      for (let x = 0; x < gridSize; x++) {
        for (let z = 0; z < gridSize; z++) {
          const tile = this.normalizeAsset(this.assets.terrain, this.tileSize);
          const pos = this.gridToWorld(x, z);
          tile.position.set(pos.x, 0, pos.z);
          tile.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);
          tile.userData.isLevelItem = true;
          this.scene.add(tile);
        }
      }
    } else {
      const geo = new THREE.PlaneGeometry(gridSize * this.tileSize, gridSize * this.tileSize);
      const mat = new THREE.MeshStandardMaterial({ color: 0xA0522D, roughness: 0.9 });
      const floor = new THREE.Mesh(geo, mat);
      floor.rotation.x = -Math.PI / 2;
      floor.userData.isLevelItem = true;
      this.scene.add(floor);
    }

    // OBSTACLES
    if (mapData.obstacles) {
      mapData.obstacles.forEach(obs => {
        let model = null;
        const useTree = Math.random() > 0.6 && this.assets.trees.length > 0;
        const list = useTree ? this.assets.trees : this.assets.rocks;
        if (list && list.length > 0) {
          model = list[Math.floor(Math.random() * list.length)];
        }

        let instance;
        if (model) {
          instance = this.normalizeAsset(model, this.tileSize * 0.9);
        } else {
          const geo = new THREE.DodecahedronGeometry(this.tileSize * 0.4);
          const mat = new THREE.MeshStandardMaterial({ color: 0x555555 });
          instance = new THREE.Mesh(geo, mat);
          instance.position.y = 0.4;
        }
        const pos = this.gridToWorld(obs.x, obs.z);
        instance.position.x = pos.x;
        instance.position.z = pos.z;
        instance.rotation.y = Math.random() * Math.PI * 2;
        instance.userData.isLevelItem = true;
        this.scene.add(instance);
      });
    }

    // MINERALS
    if (mapData.minerals) {
      const geo = new THREE.OctahedronGeometry(this.tileSize * 0.3);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x00FFFF,
        emissive: 0x0088AA,
        emissiveIntensity: 0.8,
        metalness: 0.9
      });
      mapData.minerals.forEach(min => {
        const crystal = new THREE.Mesh(geo, mat);
        const pos = this.gridToWorld(min.x, min.z);
        crystal.position.set(pos.x, 0.5, pos.z);
        crystal.userData = {
          isLevelItem: true, isCrystal: true,
          baseY: 0.5, speed: Math.random() + 1,
          x: min.x, z: min.z
        };
        this.scene.add(crystal);
        this.crystals.push(crystal);
      });
    }

    // BASE
    const baseGeo = new THREE.CylinderGeometry(this.tileSize * 0.4, this.tileSize * 0.5, 0.2, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    const basePos = this.gridToWorld(0, 0);
    base.position.set(basePos.x, 0.1, basePos.z);
    base.userData.isLevelItem = true;
    this.scene.add(base);

    // ROVER
    this.createRover(mapData.roverStart);
    this.fitCamera(gridSize);
  }

  createRover(startPos) {
    const x = startPos ? startPos.x : 0;
    const z = startPos ? startPos.z : 0;

    // Design simples de Rover
    const geo = new THREE.BoxGeometry(0.7, 0.4, 0.9);
    const mat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF }); // Branco Brilhante
    this.rover = new THREE.Mesh(geo, mat);

    const cockpit = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.3, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x111111 }) // Vidro escuro
    );
    cockpit.position.y = 0.35;
    cockpit.position.z = -0.2;
    this.rover.add(cockpit);

    // Rodas
    const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const wheels = [
      { x: 0.4, z: 0.3 }, { x: -0.4, z: 0.3 },
      { x: 0.4, z: -0.3 }, { x: -0.4, z: -0.3 }
    ];
    wheels.forEach(pos => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(pos.x, 0, pos.z);
      this.rover.add(w);
    });

    this.rover.castShadow = true;
    this.rover.userData.isLevelItem = true;
    this.updateRover(x, z, 'north');
    this.scene.add(this.rover);
  }

  updateRover(x, z, direction) {
    if (!this.rover) return;
    const pos = this.gridToWorld(x, z);
    this.rover.position.set(pos.x, 0.4, pos.z);
    const rots = { 
      north: Math.PI, south: 0, east: -Math.PI / 2, west: Math.PI / 2 
    };
    this.rover.rotation.y = rots[direction.toLowerCase()] || 0;
  }

  hideMineral(x, z) {
    const target = this.crystals.find(c =>
      c.visible && c.userData.x === x && c.userData.z === z
    );
    if (target) target.visible = false;
  }

  gridToWorld(x, z) {
    return {
      x: (x * this.tileSize) - this.offset,
      z: (z * this.tileSize) - this.offset
    };
  }

  fitCamera(gridSize) {
    const size = gridSize * this.tileSize;
    const aspect = this.container.clientWidth / this.container.clientHeight;
    const zoom = size / 1.2;
    this.camera.left = -zoom * aspect;
    this.camera.right = zoom * aspect;
    this.camera.top = zoom;
    this.camera.bottom = -zoom;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(0, 0, 0);
  }

  resize() {
    if (!this.container || !this.renderer) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    const aspect = w / h;
    const zoom = (this.camera.top - this.camera.bottom) / 2;
    this.camera.left = -zoom * aspect;
    this.camera.right = zoom * aspect;
    this.camera.updateProjectionMatrix();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const time = Date.now() * 0.002;
    this.crystals.forEach(c => {
      if (c.visible) {
        c.position.y = c.userData.baseY + Math.sin(time * c.userData.speed) * 0.1;
        c.rotation.y += 0.02;
      }
    });
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}