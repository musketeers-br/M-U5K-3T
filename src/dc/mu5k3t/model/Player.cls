Class dc.mu5k3t.model.Player Extends %RegisteredObject
{

ClassMethod Login(user As %String, Output gamer As %DynamicObject) As %Status
{
    Set tSC = $$$OK
    Try {
        Set player = ##class(dc.mu5k3t.storage.Player).UserIdxOpen(user)
        
        If $IsObject(player) {
            $$$ThrowOnError(..ReturnSuccess(player, .gamer))
            Return $$$OK
        }

        // Verifica se usuário existe na DC (Developer Community)
        Set req = ##class(%Net.HttpRequest).%New()
        Set req.Server = "community.intersystems.com"
        Set req.SSLConfiguration = "ISC.FeatureTracker.SSL.Config" 
        Set req.Https = 1
        $$$ThrowOnError(req.Head("/user/"_user))

        If (req.HttpResponse.StatusCode = 200) {
            Set player = ##class(dc.mu5k3t.storage.Player).GetOrCreate(user)
            $$$ThrowOnError(..ReturnSuccess(player, .gamer))
            Return $$$OK
        } 
        Throw $$$ERROR(5002, "User '"_user_"' not found in InterSystems Developer Community.")
    } Catch ex {
        Set tSC=ex.AsStatus()
    }
    Return tSC
}

ClassMethod ReturnSuccess(player As dc.mu5k3t.storage.Player, Output output As %DynamicObject = "") As %Status
{
    Set tSC = $$$OK
    Try {
        Set output = {
            "status": "success",
            "username": (player.Username),
            "profile": (player.CommunityURL),
            "joinDate": (player.JoinDate)
        }
    } Catch ex {
        Set tSC=ex.AsStatus()
    }
    Return tSC
}

ClassMethod Dashboard(user As %String, Output dashboard As %DynamicObject) As %Status
{
    Set tSC = $$$OK
    Set dashboard = {}
    Try {
        Set player = ##class(dc.mu5k3t.storage.Player).UserIdxOpen(user)
        Throw:('$IsObject(player)) $$$ERROR(5002,"User not found") 

        Set dashboard = {
            "user": (player.Username),
            "profile": (player.CommunityURL),
            "joinDate": (player.JoinDate),
            "missions": []
        }
        
        Set isPreviousMissionDone = 1 
        Set statement = ##class(%SQL.Statement).%New()
        $$$ThrowOnError(statement.%PrepareClassQuery("dc.mu5k3t.storage.Mission", "GetAllMissions"))
        
        Set resultset = statement.%Execute()
        
        While resultset.%Next() {
            Set mId = resultset.%Get("ID")
            Set mCode = resultset.%Get("Code")
            
            Set completed = 0, rank = "-", highScore = 0
            Set attempted = 0
            
            $$$ThrowOnError(..CheckMissionStatus(player.%Id(), mId, .highScore, .attempted))
            
            Set highScore = +highScore 
            
            If (attempted) {
                Set completed = 1
                If (highScore > 0) {
                    $$$ThrowOnError(..GetGlobalRanking(mId, highScore, .rank))
                }
            }
            
            Set status = "LOCKED"
            If (isPreviousMissionDone) {
                Set status = "OPEN"
                If completed Set status = "COMPLETED"
            }
            
            Set missionObj = {
                "id": (mCode),
                "name": (resultset.%Get("Name")),
                "description": (resultset.%Get("Description")),
                "highScore": (highScore),
                "rank": (rank),
                "status": (status)
            }
            
            Do dashboard.missions.%Push(missionObj)
            
            Set isPreviousMissionDone = completed
        }
    } Catch ex {
        Set tSC=ex.AsStatus()
    }
    Return tSC
}

ClassMethod CheckMissionStatus(playerId As %String, missionId As %String, Output highScore As %Integer, Output attempted As %Boolean) As %Status
{
    Set tSC = $$$OK
    Set highScore = 0
    Set attempted = 0
    Try {
        Set statement = ##class(%SQL.Statement).%New()
        $$$ThrowOnError(statement.%PrepareClassQuery("dc.mu5k3t.storage.MissionLog", "GetHighScore"))
        Set rs = statement.%Execute(playerId, missionId)
        If rs.%Next() {
            Set highScore = +rs.%Get("highScore")
        }
        
        Set sql = "SELECT TOP 1 ID FROM dc_mu5k3t_storage.MissionLog WHERE Player = ? AND Mission = ?"
        Set stmt = ##class(%SQL.Statement).%New()
        $$$ThrowOnError(stmt.%Prepare(sql))
        Set rs2 = stmt.%Execute(playerId, missionId)
        If rs2.%Next() {
            Set attempted = 1
        }
        
    } Catch ex {
        Set tSC=ex.AsStatus()
    }
    Return tSC
}

ClassMethod GetHighScore(playerId As %String, missionId As %String, Output highScore As %Integer = 0) As %Status
{
    Set tSC = $$$OK
    Set highScore = 0
    Try {
        Set statement = ##class(%SQL.Statement).%New()
        $$$ThrowOnError(statement.%PrepareClassQuery("dc.mu5k3t.storage.MissionLog", "GetHighScore"))
        Set rs = statement.%Execute(playerId, missionId)
        If rs.%Next() {
            Set highScore = +rs.%Get("highScore")
        }
    } Catch ex {
        Set tSC=ex.AsStatus()
    }
    Return tSC
}

ClassMethod GetGlobalRanking(missionId As %String, highScore As %Integer, Output rank As %String = "") As %Status
{
    Set tSC = $$$OK
    Set rank = "-"
    Try {
        Set statement = ##class(%SQL.Statement).%New()
        $$$ThrowOnError(statement.%PrepareClassQuery("dc.mu5k3t.storage.MissionLog", "GetGlobalRanking"))
        Set rs = statement.%Execute(missionId, highScore)
        If rs.%Next() {
            Set rank = "#" _ rs.%Get("Rank")
        }
    } Catch ex {
        Set tSC=ex.AsStatus()
    }
    Return tSC
}

ClassMethod ValidateUserCode(pCode As %String) As %String [ Language = python ]
{
    import re
    import json
    
    response = {}
    valid = True
    reason = ""

    # 1. Globals (permitir apenas ^||)
    if re.search(r'\^(?!\|\|)', pCode):
        valid = False
        reason = "SECURITY ALERT: Acesso a Globais Persistentes é proibido. Utilize globais temporárias (^||Name)."

    # 2. System class
    if valid and re.search(r'##class', pCode, re.IGNORECASE):
        valid = False
        reason = "SECURITY ALERT: Instanciação direta de classes (##class) é proibida."
        
    # Block: $System, $ZF, Job, Halt, Xecute, $Job
    dangerous_pattern = r'(\$System|\$ZF|\$Job|\bJob\b|\bHalt\b|\bXecute\b)'
    if valid and re.search(dangerous_pattern, pCode, re.IGNORECASE):
        valid = False
        reason = "SECURITY ALERT: Comandos de Sistema ($System, Job, Halt) detectados."
        
    if valid and re.search(r'\$\$[\w\^]+', pCode):
        valid = False
        reason = "SECURITY ALERT: Chamadas diretas de rotina são proibidas."

    response["valid"] = 1 if valid else 0
    response["reason"] = reason
    return json.dumps(response)
}

/// Core logic: Simulator execution and persistence
ClassMethod MissionDeploy(payload As %DynamicObject, Output response As %DynamicObject) As %Status
{
    Set tSC = $$$OK
    Try {
        Set user = payload.username
        Set missionCode = payload.missionId
        Set code = payload.code
        
        // 1. Launch Simulator
        Set simulator = ##class(dc.mu5k3t.engine.Simulator).%New()
        Set response = simulator.RunMission(missionCode, code, user)
        
        // 2. Persist Result
        If (response.status = "VICTORY") || (response.status = "FUEL_DEPLETED") || (response.status = "HULL_BREACH") {
            Set tSCLog = ##class(dc.mu5k3t.storage.MissionLog).RecordLog(
                user, 
                missionCode, 
                code, 
                response.stats
            )
            If $$$ISERR(tSCLog) {
                Set response.logError = $System.Status.GetErrorText(tSCLog)
            }
        }
        
    } Catch ex {
        Set tSC=ex.AsStatus()
    }

    Return tSC
}

/// Worker Entry Point: Runs in a separate process.
/// Any 'Write' here goes to the system log, NOT the HTTP response.
/// Worker Entry Point: Runs in background process.
ClassMethod MissionDeployWorker(pPayloadStr As %String, pTicketID As %String) As %Status
{
    Set tSC = $$$OK
    Try {
        // 1. Rehydrate Payload (String -> Object)
        Set payload = {}.%FromJSON(pPayloadStr)
        
        // 2. Validate Code
        Set security = ..ValidateUserCode(payload.code)
        Set security = {}.%FromJSON(security)
        If security.valid = 0 {
            Set response = {}
            Set response.status = "SECURITY_VIOLATION"
            Set response.message = security.reason
            
            Do ##class(dc.mu5k3t.storage.WorkBuffer).WriteResult(pTicketID, response.%ToJSON())
            Return $$$OK
        }

        // 3. Run Logic (Player -> Simulator)
        Set tSCLogic = ..MissionDeploy(payload, .responseObj)
        If $$$ISERR(tSCLogic) {
            Set errText = $System.Status.GetErrorText(tSCLogic)
            Do ##class(dc.mu5k3t.storage.WorkBuffer).WriteResult(pTicketID, "", "ERROR", errText)
            Return $$$OK
        }
        Do ##class(dc.mu5k3t.storage.WorkBuffer).WriteResult(pTicketID, responseObj.%ToJSON())
    } Catch ex {
        Set tSC = ex.AsStatus()
        Set errText = $System.Status.GetErrorText(tSC)
        Do ##class(dc.mu5k3t.storage.WorkBuffer).WriteResult(pTicketID, "", "CRASH", errText)
    }
    Return tSC
}

}
