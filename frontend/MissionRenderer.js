import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class MissionRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`❌ MissionRenderer: Container #${containerId} not found`);
      return;
    }

    console.log("🪐 MissionRenderer build 5.2 (Heavy Rover & UI)");

    // --- UI: BACK TO DASHBOARD BUTTON ---
    this.injectUI();

    // --- CSS ENFORCEMENT ---
    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100vw';
    this.container.style.height = '100vh';
    this.container.style.zIndex = '9999';
    this.container.style.background = '#000000';
    this.container.style.display = 'block';

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
   * Injects a "Back to Dashboard" button over the 3D view
   */
  injectUI() {
    const backBtn = document.createElement('button');
    backBtn.innerText = "<< ABORT MISSION & RETURN TO HUB";
    Object.assign(backBtn.style, {
      position: 'absolute',
      top: '20px',
      right: '20px',
      padding: '12px 24px',
      backgroundColor: '#ff4d4d',
      color: 'white',
      border: '2px solid white',
      fontFamily: "'VT323', monospace",
      fontSize: '20px',
      cursor: 'pointer',
      zIndex: '10001',
      boxShadow: '0 0 15px rgba(255,0,0,0.5)'
    });

    backBtn.onmouseover = () => backBtn.style.backgroundColor = '#ff0000';
    backBtn.onmouseout = () => backBtn.style.backgroundColor = '#ff4d4d';
    
    // Uses the global navigation function from main.js
    backBtn.onclick = () => {
      if (window.backToDashboard) {
        window.backToDashboard();
      } else {
        location.reload(); // Hard fallback
      }
    };

    this.container.appendChild(backBtn);
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8B4513);
    // Fog starts far away to keep the center crystal clear
    this.scene.fog = new THREE.Fog(0x8B4513, 120, 400);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    const aspect = this.container.clientWidth / this.container.clientHeight;
    const viewSize = 40; 

    this.camera = new THREE.OrthographicCamera(-viewSize * aspect, viewSize * aspect, viewSize, -viewSize, -100, 2000);
    this.camera.position.set(60, 60, 60);
    this.camera.lookAt(0, 0, 0);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2); 
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.left = -60;
    dirLight.shadow.camera.right = 60;
    dirLight.shadow.camera.top = 60;
    dirLight.shadow.camera.bottom = -60;
    this.scene.add(dirLight);
  }

  normalizeAsset(model, targetSize) {
    if (!model) return new THREE.Object3D();
    const wrapper = new THREE.Group();
    const clone = model.clone();
    
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Scaling logic
    const scale = (maxDim > 0) ? (targetSize / maxDim) : 1;
    clone.scale.set(scale, scale, scale);
    
    // Centering logic
    const yOffset = -box.min.y * scale;
    const xOffset = -(box.min.x + size.x / 2) * scale;
    const zOffset = -(box.min.z + size.z / 2) * scale;
    clone.position.set(xOffset, yOffset, zOffset);
    
    clone.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    wrapper.add(clone);
    return wrapper;
  }

  async preloadAssets() {
    if (this.assets) return this.assets;
    const loader = new GLTFLoader();
    const load = (file) => new Promise(resolve => {
      loader.load(`./assets/${file}`, (g) => resolve(g.scene), undefined, () => resolve(null));
    });

    this.assets = {
      terrain: await load('terrain_low.gltf'),
      rocks: [(await load('Rock_1_A_Color1.gltf'))].filter(x => x),
      trees: [(await load('Tree_Bare_1_B_Color1.gltf'))].filter(x => x),
      rover: await load('dropship.gltf'),
      base: await load('lander_base.gltf')
    };
    return this.assets;
  }

  async loadMap(mapData) {
    if (!mapData) return;
    if (!this.assets) await this.preloadAssets();

    // Cleanup previous mission items
    const toRemove = [];
    this.scene.traverse(c => { if (c.userData.isLevelItem) toRemove.push(c); });
    toRemove.forEach(c => this.scene.remove(c));
    this.crystals = [];

    const gridSize = mapData.gridSize || 25;
    this.offset = (gridSize * this.tileSize) / 2 - (this.tileSize / 2);

    // 1. TERRAIN
    if (this.assets.terrain) {
      for (let x = 0; x < gridSize; x++) {
        for (let z = 0; z < gridSize; z++) {
          const tile = this.normalizeAsset(this.assets.terrain, this.tileSize);
          const pos = this.gridToWorld(x, z);
          tile.position.set(pos.x, 0, pos.z);
          tile.userData.isLevelItem = true;
          this.scene.add(tile);
        }
      }
    }

    // 2. OBSTACLES
    if (mapData.obstacles) {
      mapData.obstacles.forEach(obs => {
        const model = this.assets.rocks[0];
        if (model) {
          const instance = this.normalizeAsset(model, this.tileSize * 0.8);
          const pos = this.gridToWorld(obs.x, obs.z);
          instance.position.set(pos.x, 0, pos.z);
          instance.userData.isLevelItem = true;
          this.scene.add(instance);
        }
      });
    }

    // 3. MINERALS
    if (mapData.minerals) {
      const geo = new THREE.OctahedronGeometry(this.tileSize * 0.3);
      const mat = new THREE.MeshStandardMaterial({ color: 0x00FFFF, emissive: 0x00FFFF, emissiveIntensity: 0.5 });
      mapData.minerals.forEach(min => {
        const crys = new THREE.Mesh(geo, mat);
        const pos = this.gridToWorld(min.x, min.z);
        crys.position.set(pos.x, 0.5, pos.z);
        crys.userData = { isLevelItem: true, isCrystal: true, baseY: 0.5, x: min.x, z: min.z };
        this.scene.add(crys);
        this.crystals.push(crys);
      });
    }

    // 4. BASE STATION
    if (this.assets.base) {
      const base = this.normalizeAsset(this.assets.base, this.tileSize * 1.5);
      const pos = this.gridToWorld(0, 0);
      base.position.set(pos.x, 0, pos.z);
      base.userData.isLevelItem = true;
      this.scene.add(base);
    }

    // 5. ROVER (Model: dropship.gltf)
    this.createRover(mapData.roverStart);
    this.fitCamera(gridSize);
  }

  createRover(startPos) {
    if (this.assets.rover) {
      // FIX: SCALE SET TO 1.2 TIMES THE TILE SIZE (Minimum size requirement met)
      this.rover = this.normalizeAsset(this.assets.rover, this.tileSize * 1.2);
    }
    
    if (this.rover) {
      this.rover.userData.isLevelItem = true;
      const pos = this.gridToWorld(startPos?.x || 0, startPos?.z || 0);
      this.rover.position.set(pos.x, 0.2, pos.z);
      this.scene.add(this.rover);
      this.updateRover(startPos?.x || 0, startPos?.z || 0, 'north');
    }
  }

  updateRover(x, z, direction) {
    if (!this.rover) return;
    const pos = this.gridToWorld(x, z);
    this.rover.position.set(pos.x, 0.2, pos.z);
    const rots = { north: Math.PI, south: 0, east: -Math.PI / 2, west: Math.PI / 2 };
    this.rover.rotation.y = rots[direction.toLowerCase()] || 0;
  }

  hideMineral(x, z) {
    const target = this.crystals.find(c => c.visible && c.userData.x === x && c.userData.z === z);
    if (target) target.visible = false;
  }

  gridToWorld(x, z) {
    return { x: (x * this.tileSize) - this.offset, z: (z * this.tileSize) - this.offset };
  }

  fitCamera(gridSize) {
    const size = gridSize * this.tileSize;
    const aspect = this.container.clientWidth / this.container.clientHeight;
    const zoom = size / 1.1; // Slightly tighter zoom
    this.camera.left = -zoom * aspect;
    this.camera.right = zoom * aspect;
    this.camera.top = zoom;
    this.camera.bottom = -zoom;
    this.camera.updateProjectionMatrix();
  }

  resize() {
    if (!this.renderer || !this.container) return;
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    const aspect = this.container.clientWidth / this.container.clientHeight;
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
        c.position.y = c.userData.baseY + Math.sin(time) * 0.1;
        c.rotation.y += 0.02;
      }
    });
    if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
  }
}