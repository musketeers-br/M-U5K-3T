[![Gitter](https://img.shields.io/badge/Available%20on-Intersystems%20Open%20Exchange-00b2a9.svg)](https://openexchange.intersystems.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat&logo=AdGuard)](LICENSE)
[![InterSystems IRIS](https://img.shields.io/badge/InterSystems-IRIS-blue.svg)](https://www.intersystems.com/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-white.svg)](https://threejs.org/)

![M-U5K-3T Banner](./banner.png)

# 🚀 M-U5K-3T

**The First Autonomous Rover Platform for Extreme Exoplanet Mining**

> *Code locally, deploy globally. Conquer the Red Planet with ObjectScript.*

---

## 🌌 Motivation

Explorating exoplanets like **M-U5K-3T** is impossible with direct control due to extreme light-speed latency. By the time you send a "Turn Left" command, your rover has already fallen into a crater.

**M-U5K-3T changes the game.**

It is a gamified simulation platform that challenges developers to write **autonomous logic** using **InterSystems ObjectScript**.
- ✅ **Code autonomously:** Write the `OnTick` logic that controls the rover's brain.
- ✅ **Simulate safely:** Test in the "Danger Room" (Client-side Simulation) with instant feedback.
- ✅ **Deploy to Orbit:** Upload your code to the server to run on the actual map (Server-side Execution).
- ✅ **Visual Feedback:** Watch your rover explore, mine, and survive in high-fidelity 3D.

---

## 🛠️ How It Works

M-U5K-3T utilizes a **Twin World Architecture** to ensure the simulation matches the server execution perfectly.

### **Core Technologies**

1. **InterSystems IRIS Data Platform**
   - Stores mission maps, user profiles, and leaderboards.
   - Executes the user's ObjectScript code in a secure Sandbox environment.
   - Generates the authoritative "Timeline" of the mission.

2. **Frontend Simulation (The Danger Room)**
   - A mirror of the server logic written in JavaScript.
   - Allows developers to test their algorithms in real-time without latency.
   - Powered by a custom Transpiler/Parser.

3. **3D Visualization Engine**
   - **Three.js** powered rendering.
   - **GLTF Assets**: Uses high-fidelity models (`dropship.gltf`, `lander_base.gltf`).
   - **Atmospheric Effects**: Dynamic fog and lighting to simulate the Martian environment.

### **Architecture Overview**


```

┌─────────────────────────────────────────────────────────────┐
│                    User (Mission Control)                   │
└─────────────────────────┬───────────────────────────────────┘
│ Writes ObjectScript
▼
┌─────────────────────────────────────────────────────────────┐
│                  Frontend (The Danger Room)                 │
│  - Mock Simulation (Instant Feedback)                       │
│  - Three.js Renderer (Preview Mode)                         │
└─────────────────────────┬───────────────────────────────────┘
│ DEPLOY (POST /api/deploy)
▼
┌─────────────────────────────────────────────────────────────┐
│                  InterSystems IRIS (Server)                 │
│  - Sandbox.CompileUserCode()                                │
│  - Mission.Run() -> Generates JSON Timeline                 │
└─────────────────────────┬───────────────────────────────────┘
│ Returns Timeline & Map Data
▼
┌─────────────────────────────────────────────────────────────┐
│                  Mission Renderer (Orbit View)              │
│  - Replays the server timeline step-by-step                 │
│  - Validates score and fuel consumption                     │
└─────────────────────────────────────────────────────────────┘

```

---

## 📋 Prerequisites

- **Docker** and **Docker Compose**
- **InterSystems IRIS** (Community Edition or Health)
- **Modern Browser** (Chrome/Firefox) for WebGL support

---

## 🛠️ Installation

### 1. **Clone the Repository**
```sh
git clone [https://github.com/musketeers-br/M-U5K-3T](https://github.com/musketeers-br/M-U5K-3T)
cd m-u5k-3t

```

### 2. **Build and Run**

```sh
docker-compose up -d --build

```

### 3. **Access Mission Control**

Open your browser at:
🌐 **http://localhost:52773/m5k3t/index.html**

---

## 💡 How to Play

### **Step 1: Analyze the Map**

Sensors indicate obstacles and minerals. Your goal is to collect minerals (Blue/Gold Crystals) and return to base (optional for some missions) without running out of **Fuel** or **HP**.

### **Step 2: Program Your Rover**

Write **ObjectScript** in the embedded terminal. You have access to the `context` object.

```objectscript
ClassMethod OnTick(context As %DynamicObject)
{
    // 1. Get Sensor Data
    Set sensors = context.rover.sensors
    Set front = sensors.front  ; "CLEAR", "OBSTACLE", "MINERAL"
    
    // 2. Decide Action (Move, Turn, Collect)
    If (front = "MINERAL") {
        Do context.Move() ; Auto-collects when stepping on it
    } ElseIf (front = "OBSTACLE") {
        Do context.Turn("east")
    } Else {
        Do context.Move()
    }
}

```

### **Step 3: Deploy**

1. Click **EXECUTE TEST** to run in the Simulation (Danger Room).
2. Click **DEPLOY TO ORBIT** to send your code to the server.
3. Watch the replay. If successful, the next mission unlocks!

---

## 🗂️ Project Structure

```
m-u5k-3t/
├── src/
│   ├── dc/
│   │   └── mu5k3t/
│   │       ├── engine/          # Game Logic (Server Side)
│   │       │   ├── Sandbox.cls  # Secure Code Execution
│   │       │   ├── Game.cls     # Physics & Rules
│   │       └── api/             # REST API
├── frontend/
│   ├── index.html               # Main UI
│   ├── main.js                  # App Logic & State Machine
│   ├── simulation.js            # Client-side Physics Engine
│   ├── MissionRenderer.js       # Three.js Visualization Class
│   └── assets/                  # 3D Models (GLTF) & Textures
├── docker-compose.yml
└── README.md

```

---

## 📊 Roadmap

### ✅ **v1.0 MVP (Current)**

* [x] Basic Movement & Physics
* [x] ObjectScript Transpiler/Executor
* [x] 3D Renderer with Three.js
* [x] "Twin World" Sync (Client/Server)
* [x] Asset Pipeline (GLTF Loader)

---

## 🎖️ Credits

`M-U5K-3T` is developed with 💜 by the **Musketeers Team**:

* [José Roberto Pereira](https://community.intersystems.com/user/jos%C3%A9-roberto-pereira-0)
* [Henry Pereira](https://community.intersystems.com/user/henry-pereira)
* [Henrique Dias](https://community.intersystems.com/user/henrique-dias-2)

---

## 📄 License

This project is licensed under the [MIT License](https://www.google.com/search?q=LICENSE).
