Class dc.mu5k3t.model.Player Extends %RegisteredObject
{

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
            Set mId = resultset.%Get("ID"), mCode = resultset.%Get("Code")
            Set completed = 0, rank = "-"
            $$$ThrowOnError(..GetHighScore(player.%Id(), mId, .highScore))
            Set highScore = +highScore
            If (highScore > 0) Set completed = 1
            If (completed) {
                $$$ThrowOnError(..GetGlobalRanking(mId, highScore, .rank))
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

ClassMethod GetHighScore(playerId As %String, missionId As %String, Output highScore As %Integer = 0) As %Status
{
    Set tSC = $$$OK
    Try {
        Set statement = ##class(%SQL.Statement).%New()
        $$$ThrowOnError(statement.%PrepareClassQuery("dc.mu5k3t.storage.MissionLog", "GetHighScore"))
        Set rs = statement.%Execute(playerId, missionId)
        If rs.%Next() Set highScore = +rs.%Get("highScore")
    } Catch ex {
        Set tSC=ex.AsStatus()
    }
    Return tSC
}

ClassMethod GetGlobalRanking(missionId As %String, highScore As %String, Output rank As %String = "") As %Status
{
    Set tSC = $$$OK
    Try {
        Set rank = ""
        Set statement = ##class(%SQL.Statement).%New()
        $$$ThrowOnError(statement.%PrepareClassQuery("dc.mu5k3t.storage.MissionLog", "GetGlobalRanking"))
        Set rs = statement.%Execute(missionId, highScore)
        If rs.%Next() Set rank = "#"_rs.%Get("Rank")
    } Catch ex {
        Set tSC=ex.AsStatus()
    }
    Return tSC
}

}
