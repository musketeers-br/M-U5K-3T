Class dc.mu5k3t.model.Map Extends %RegisteredObject
{

/// Generates and returns the Map JSON based on Mission and Mode
ClassMethod GetMap(mission As %String, mode As %String, Output map As %DynamicObject) As %Status
{
    Set tSC = $$$OK
    Try {
            
        // 1. Fetch the Map Definition from Storage
        Set config = ##class(dc.mu5k3t.storage.MapDefinition).ConfigIdxOpen(mission, mode)
        
        If '$IsObject(config) {
            // Fallback default if not configured
            Return $$$ERROR(5002,"Map configuration not found for " _ mission _ " / " _ mode)
        }

        // 2. Generate the JSON Procedurally based on Config
        Set map = ..GenerateMapJSON(config)
    } Catch ex {
        Set tSC=ex.AsStatus()
    }
    Return tSC
}

/// Internal Procedural Map Generator
ClassMethod GenerateMapJSON(config As dc.mu5k3t.storage.MapDefinition) As %DynamicObject
{
        Set size = config.GridSize
        Set algo = config.Algorithm
        
        Set map = {}
        Set map.gridSize = size
        Set map.baseStation = { "x": 0, "z": 0 }
        Set map.config = { "tileSize": 1.2, "gap": 0.1 }
        
        Set map.obstacles = []
        Set map.minerals = []
        Set map.hazards = []

        // --- ALGORITHM: OPEN FIELD (M1) ---
        If algo = "OPEN_FIELD" {
            // Random scatter: ~10% obstacles, ~5% minerals
            For i=1:1:(size*size*0.1) {
                Do ..AddRandomItem(map.obstacles, size)
            }
            For i=1:1:(size*size*0.05) {
                Do ..AddRandomItem(map.minerals, size, 50)
            }
        }

        // --- ALGORITHM: CORRIDOR (M2) ---
        If algo = "CORRIDOR" {
            // Create "walls" to simulate rivers/canyons
            For i=1:1:(size/2) {
                Set startX = $Random(size), startZ = $Random(size)
                // Draw a line of blocks
                For k=0:1:5 {
                    Do map.obstacles.%Push({ "x": (startX+k), "z": (startZ) })
                }
            }
            // Add minerals in gaps
            For i=1:1:(size*size*0.08) {
                Do ..AddRandomItem(map.minerals, size, 50)
            }
        }

        // --- ALGORITHM: HAZARD CLUSTERS (M3) ---
        If algo = "HAZARD_CLUSTERS" {
            // Add toxic pools
            For i=1:1:3 {
                Set cx = $Random(size), cz = $Random(size)
                // 3x3 hazard patch
                For dx=-1:1:1 { For dz=-1:1:1 {
                    Do map.hazards.%Push({ "x": (cx+dx), "z": (cz+dz) })
                }}
            }
            // Standard obstacles and minerals
            For i=1:1:(size*size*0.15) { Do ..AddRandomItem(map.obstacles, size) }
            For i=1:1:(size*size*0.06) { Do ..AddRandomItem(map.minerals, size, 50) }
        }

        Quit map
}

/// Helper to add unique random items (prevents overlapping base station)
ClassMethod AddRandomItem(list As %DynamicArray, size As %Integer, value As %Integer = "")
{
        Set x = $Random(size)
        Set z = $Random(size)
        
        // Don't block the base
        If (x=0) && (z=0) Quit 
        
        Set item = { "x": (x), "z": (z) }
        If value'="" { Set item.value = value }
        
        Do list.%Push(item)
}

}
