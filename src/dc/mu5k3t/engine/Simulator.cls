Class dc.mu5k3t.engine.Simulator Extends %RegisteredObject
{

Property GridSize As %Integer;

Property MapData As %DynamicObject;

Property Memory As %DynamicObject;

Property Rover As %DynamicObject;

Property Timeline As %DynamicArray;

Property MineralsCollected As %Integer [ InitialExpression = 0 ];

/// Main Entry Point
Method RunMission(pMissionCode As %String, pUserCode As %String, pUser As %String) As %DynamicObject
{
    Set response = {}
    Set ..Timeline = []
    
    // 1. Load Map
    Set tSC = ##class(dc.mu5k3t.model.Map).GetMap(pMissionCode, "DEPLOY", .map)
    If $$$ISERR(tSC) {
        Set response.status = "MAP_ERROR"
        Set response.message = "Could not load map data."
        Quit response
    }
    Set ..MapData = map
    Set ..GridSize = map.gridSize
    
    // 2. Init Rover
    Set ..Rover = { "fuel": 100, "hp": 100, "score": 0 }
    Set ..Rover.x = map.roverStart.x
    Set ..Rover.z = map.roverStart.z
    Set ..Rover.direction = "north"
    Set ..MineralsCollected = 0
    Set ..Memory = {}
    
    // 3. Compile (Sandbox)
    // O silêncio é garantido pelo Dispatch agora.
    Set tSC = ##class(dc.mu5k3t.engine.Sandbox).CompileUserCode(pUserCode, .userClass)
    If $$$ISERR(tSC) {
        Set response.status = "COMPILE_ERROR"
        Set response.message = $System.Status.GetErrorText(tSC)
        Quit response
    }
    
    // 4. Game Loop
    Set maxSteps = 200
    Set step = 0
    Set missionStatus = "RUNNING"
    
    While (step < maxSteps) && (..Rover.fuel > 0) && (..Rover.hp > 0) && (missionStatus = "RUNNING") {
        Set step = step + 1
        
        Set context = {}
        Set context.rover = {}
        Set context.rover.sensors = ..ScanSensors()
        Set context.memory = ..Memory
        Set context.action = {} 
        
        // Execute User Code
        // (Já estamos no dispositivo NULL, então Writes do usuário são seguros)
        Try {
            Do $ClassMethod(userClass, "OnTick", context)
        } Catch ex {
            Set missionStatus = "RUNTIME_ERROR"
            Set response.error = ex.DisplayString()
            Quit 
        }
        
        // Physics & Logic
        Set actionLog = ..ProcessAction(context.action)
        Set actionLog.step = step
        Set actionLog.roverState = {}.%FromJSON(..Rover.%ToJSON()) 
        Do ..Timeline.%Push(actionLog)
        
        // Victory Condition: 5 Minerals + Base
        If (..MineralsCollected >= 5) && (..Rover.x = 0) && (..Rover.z = 0) { 
            Set missionStatus = "VICTORY" 
        }
    }
    
    // Cleanup
    Do ##class(dc.mu5k3t.engine.Sandbox).Cleanup(userClass)
    
    // Final Status Logic
    If missionStatus = "RUNNING" { Set missionStatus = "FUEL_DEPLETED" }
    If ..Rover.hp <= 0 { Set missionStatus = "HULL_BREACH" }
    
    Set response.status = missionStatus
    Set response.timeline = ..Timeline
    Set response.finalScore = ..Rover.score
    Set response.mapUsed = ..MapData 
    
    Set response.stats = {}
    Set response.stats.minerals = ..MineralsCollected
    Set response.stats.fuelUsed = (100 - ..Rover.fuel)
    Set response.stats.hpLost = (100 - ..Rover.hp)
    Set response.stats.success = (missionStatus = "VICTORY")
    
    Return response
}

/// Real Raycasting: Checks the server-side map for obstacles
Method ScanSensors() As %DynamicObject
{
    Set sensors = {}
    Set cx = ..Rover.x, cz = ..Rover.z, dir = ..Rover.direction
    
    Set sensors.front       = ..CheckTile(..GetRelCoords(cx, cz, dir, "front", 1))
    Set sensors."front_far" = ..CheckTile(..GetRelCoords(cx, cz, dir, "front", 2))
    Set sensors.left        = ..CheckTile(..GetRelCoords(cx, cz, dir, "left", 1))
    Set sensors.right       = ..CheckTile(..GetRelCoords(cx, cz, dir, "right", 1))
    
    Return sensors
}

/// Helper: Returns Tile Type (CLEAR, OBSTACLE, MINERAL)
Method CheckTile(coords As %DynamicObject) As %String
{
    Set x = coords.x, z = coords.z
    // Walls
    If (x < 0) || (z < 0) || (x >= ..GridSize) || (z >= ..GridSize) Return "OBSTACLE"
    
    // Obstacles
    Set iter = ..MapData.obstacles.%GetIterator()
    While iter.%GetNext(.k, .o) { If (o.x=x)&&(o.z=z) Return "OBSTACLE" }
    
    // Minerals
    Set iter = ..MapData.minerals.%GetIterator()
    While iter.%GetNext(.k, .m) { If (m.x=x)&&(m.z=z) Return "MINERAL" }
    
    Return "CLEAR"
}

/// Helper: Calculates Target Coordinates based on Direction
Method GetRelCoords(x, z, facing, relDir, steps) As %DynamicObject
{
    Set facing = $ZCVT(facing,"L"), relDir = $ZCVT(relDir,"L")
    Set dirs = $ListBuild("north", "east", "south", "west")
    Set idx = $ListFind(dirs, facing)
    
    // Rotation Math: Front=0, Right=+1, Back=+2, Left=+3
    Set off = 0
    If relDir="right" { Set off=1 }
    ElseIf relDir="back" { Set off=2 }
    ElseIf relDir="left" { Set off=3 }
    
    Set targetIdx = ((idx - 1 + off) # 4) + 1
    Set tDir = $ListGet(dirs, targetIdx)
    
    Set dx=0, dz=0
    If tDir="north" { Set dz = -steps }
    If tDir="south" { Set dz = steps }
    If tDir="east"  { Set dx = steps }
    If tDir="west"  { Set dx = -steps }
    
    Return { "x": (x+dx), "z": (z + dz) }
}

Method ProcessAction(action As %DynamicObject) As %DynamicObject
{
    Set result = { "action": "WAIT" }
    
    If action.%IsDefined("turn") {
        Set dir = $ZCVT(action.turn, "L")
        If $ListFind($ListBuild("north","south","east","west"), dir) {
            Set ..Rover.direction = dir
            Set result.action = "TURN"
            Set result.param = dir
        }
    }
    
    If action.%IsDefined("move") || action.%IsDefined("rotate_and_move") {
        Set dir = ..Rover.direction
        If action.%IsDefined("rotate_and_move") {
            Set dir = $ZCVT(action.rotate_and_move, "L")
            Set ..Rover.direction = dir
            Set result.action = "ROTATE_MOVE"
        } Else {
            Set result.action = "MOVE"
        }
        
        Set t = ..GetRelCoords(..Rover.x, ..Rover.z, dir, "front", 1)
        Set check = ..CheckTile(t)
        
        If check = "OBSTACLE" {
            Set ..Rover.hp = ..Rover.hp - 10
            Set result.collision = "OBSTACLE"
        } Else {
            Set ..Rover.x = t.x, ..Rover.z = t.z
            If check = "MINERAL" {
                Set iter = ..MapData.minerals.%GetIterator()
                While iter.%GetNext(.k, .m) {
                    If (m.x=t.x)&&(m.z=t.z) {
                        Do ..MapData.minerals.%Remove(k)
                        Set ..MineralsCollected = ..MineralsCollected+1
                        Set ..Rover.score = ..Rover.score+50
                        Set result.event = "COLLECT"
                        Quit
                    }
                }
            }
        }
        Set ..Rover.fuel = ..Rover.fuel - 1
    }
    
    Return result
}

}
