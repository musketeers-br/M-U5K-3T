Class dc.mu5k3t.Setup Extends %RegisteredObject
{

/// Run this method to initialize the entire database
/// Do ##class(dc.mu5k3t.Setup).Init()
ClassMethod Init() As %Status
{
    Set tSC = $$$OK
    Try {
        Write "Loading Missions...", !
        Set tSC = ..LoadMissions()
        If $$$ISERR(tSC) Throw ##class(%Exception.StatusException).CreateFromStatus(tSC)
        
        Write "Configuring Maps...", !
        Set tSC = ..ConfigureMaps()
        If $$$ISERR(tSC) Throw ##class(%Exception.StatusException).CreateFromStatus(tSC)
        
        Write "Database initialized successfully.", !
        
    } Catch ex {
        Set tSC = ex.AsStatus()
        Write "Error during setup: ", $System.Status.GetErrorText(tSC), !
    }
    Return tSC
}

/// Populates the MapDefinition table with Simulation and Orbit (Deploy) configs
ClassMethod ConfigureMaps() As %Status
{
    Set tSC = $$$OK
    Try {
        // Clear previous data to avoid duplicates/conflicts
        Do ##class(dc.mu5k3t.storage.MapDefinition).%KillExtent()
        
        // --- Mission 1 (First Cut) ---
        // Simulation: Small grid for easy debugging
        Do ..CreateMap("M1", "SIMULATION", 10, "OPEN_FIELD")
        // Orbit (Deploy): Standard size
        Do ..CreateMap("M1", "DEPLOY", 25, "OPEN_FIELD")

        // --- Mission 2 (Ghost Corridor) ---
        // Simulation: Medium grid, corridor logic
        Do ..CreateMap("M2", "SIMULATION", 15, "CORRIDOR")
        // Orbit (Deploy): Large grid, long corridors
        Do ..CreateMap("M2", "DEPLOY", 50, "CORRIDOR")

        // --- Mission 3 (Toxic Planet) ---
        // Simulation: Introduction to hazards
        Do ..CreateMap("M3", "SIMULATION", 20, "HAZARD_CLUSTERS")
        // Orbit (Deploy): Massive hazardous wasteland
        Do ..CreateMap("M3", "DEPLOY", 75, "HAZARD_CLUSTERS")
        
    } Catch ex {
        Set tSC = ex.AsStatus()
    }
    Return tSC
}

/// Helper to create a single MapDefinition record
ClassMethod CreateMap(pMission As %String, pMode As %String, pSize As %Integer, pAlgo As %String)
{
    Set map = ##class(dc.mu5k3t.storage.MapDefinition).%New()
    Set map.MissionCode = pMission
    Set map.Mode = pMode
    Set map.GridSize = pSize
    Set map.Algorithm = pAlgo
    
    Set sc = map.%Save()
    If $$$ISERR(sc) {
        Write "Failed to create map for ", pMission, " / ", pMode, ": ", $System.Status.GetErrorText(sc), !
    } Else {
        Write "  > Map configured: ", pMission, " (", pMode, ") - Grid: ", pSize, !
    }
}

/// Populate initial mission data with dark humor flavor
ClassMethod LoadMissions() As %Status
{
    set tSC = $$$OK
    
    try {
        // Mission 1: First Cut
        set m1 = ##class(dc.mu5k3t.storage.Mission).%New()
        set m1.Code = "M1"
        set m1.Name = "First Cut"
        set m1.Description = "Good news: the minerals are abundant. Bad news: everything else is trying to kill you. Start simple—collect samples and try not to crash into rocks. We believe in you. Mostly."
        set m1.Objectives = "{""minMinerals"":5}"
        set sc = m1.%Save()
        quit:$$$ISERR(sc)
        
        // Mission 2: Ghost Corridor
        set m2 = ##class(dc.mu5k3t.storage.Mission).%New()
        set m2.Code = "M2"
        set m2.Name = "Ghost Corridor"
        set m2.Description = "Navigate narrow canyons filled with fallen debris. Think of it as a river of treasure—except the river is jagged rocks and radiation fog. Use your lateral sensors wisely, or become a permanent geological feature. Return to base if possible."
        set m2.Objectives = "{""minMinerals"":10,""returnBase"":true}"
        set sc = m2.%Save()
        quit:$$$ISERR(sc)
        
        // Mission 3: Toxic Planet Circuit
        set m3 = ##class(dc.mu5k3t.storage.Mission).%New()
        set m3.Code = "M3"
        set m3.Name = "Toxic Planet Circuit"
        set m3.Description = "The full M‑U5K‑3T experience: radiation storms, corrosive dust, and obstacle fields that look like they're actively conspiring against you. Collect minerals from multiple zones, manage your fuel like your life depends on it (because it does), and return home with style—or at least, return home."
        set m3.Objectives = "{""minMinerals"":15,""returnBase"":true,""minFuel"":20}"
        set sc = m3.%Save()
        quit:$$$ISERR(sc)
        
        write !, "✓ Mission data loaded successfully into M‑U5K‑3T database."
        write !, "  → M1: First Cut"
        write !, "  → M2: Ghost Corridor"
        write !, "  → M3: Toxic Planet Circuit"
        
    } catch ex {
        set tSC = ex.AsStatus()
        write !, "✗ Error loading missions: ", $System.Status.GetErrorText(sc)
    }
    
    Return tSC
}

}
