Class dc.mu5k3t.storage.MissionLog Extends (%Persistent, %JSON.Adaptor) [ CompileAfter = (dc.mu5k3t.storage.Player, dc.mu5k3t.storage.Mission) ]
{

/// Relationship (Parent): The Player owns this log physically.
Relationship Player As dc.mu5k3t.storage.Player [ Cardinality = parent, Inverse = MissionLogs ];

/// Relationship (One): Links to the Mission definition.
/// This is NOT a parent relationship, just a link.
Relationship Mission As dc.mu5k3t.storage.Mission [ Cardinality = one, Inverse = Logs ];

Property SourceCode As %Stream.GlobalCharacter;

Property MineralsCollected As %Integer;

Property FuelUsed As %Integer;

Property HpLost As %Integer;

Property Success As %Boolean;

Property TotalScore As %Integer;

Property LogDate As %TimeStamp [ InitialExpression = {$ZDateTime($Horolog, 3)} ];

/// Records the official result of a Deploy execution
ClassMethod RecordLog(pUsername As %String, pMissionCode As %String, pSourceCode As %String, pStats As %DynamicObject) As %Status
{
        Set tSC = $$$OK
        Try {
                // 1. Get Player
                Set player = ##class(dc.mu5k3t.storage.Player).GetOrCreate(pUsername)
                
                // 2. Get Mission
                Set mission = ##class(dc.mu5k3t.storage.Mission).CodeIndexOpen(pMissionCode)
                // If mission doesn't exist in DB yet (fresh install), create it gracefully or skip
                If '$IsObject(mission) {
                // For MVP robustness, we create a stub mission if missing
                Set mission = ##class(dc.mu5k3t.storage.Mission).%New()
                Set mission.Code = pMissionCode
                Set mission.Name = "Unknown Mission"
                Do mission.%Save()
                }
                
                // 3. Create Log
                Set log = ..%New()
                Set log.Player = player
                Set log.Mission = mission
                
                // 4. Fill Stats
                Set log.MineralsCollected = +pStats.minerals
                Set log.FuelUsed = +pStats.fuelUsed
                Set log.HpLost = +pStats.hpLost
                Set log.Success = +pStats.success
                
                // 5. Save Source Code
                Do log.SourceCode.Write(pSourceCode)
                
                // 6. Calculate Score (Simple Formula)
                // Base 1000 + (Minerals * 100) - (Fuel * 2) - (HP Lost * 5)
                Set baseScore = 0
                If log.Success Set baseScore = 1000
                
                Set score = baseScore + (log.MineralsCollected * 100) - (log.FuelUsed * 2) - (log.HpLost * 5)
                If score < 0 Set score = 0
                Set log.TotalScore = score
                
                $$$ThrowOnError(log.%Save())
                
        } Catch ex {
                Set tSC = ex.AsStatus()
        }
        Return tSC
}

/// Helper Query for Leaderboard
Query GetHighScore(pPlayerId As %String, pMissionId As %String) As %SQLQuery [ SqlProc ]
{
        SELECT MAX(TotalScore) As highScore 
        FROM dc_mu5k3t_storage.MissionLog 
        WHERE Player = :pPlayerId AND Mission = :pMissionId AND Success = 1
}

/// Helper Query for Global Ranking
Query GetGlobalRanking(pMissionId As %String, pScore As %Integer) As %SQLQuery [ SqlProc ]
{
        SELECT COUNT(*) + 1 As Rank
        FROM (
                SELECT MAX(TotalScore) as max_score 
                FROM dc_mu5k3t_storage.MissionLog 
                WHERE Mission = :pMissionId 
                GROUP BY Player
        ) 
        WHERE max_score > :pScore
}

Storage Default
{
<Data name="MissionLogDefaultData">
<Value name="1">
<Value>%%CLASSNAME</Value>
</Value>
<Value name="2">
<Value>Mission</Value>
</Value>
<Value name="3">
<Value>SourceCode</Value>
</Value>
<Value name="4">
<Value>MineralsCollected</Value>
</Value>
<Value name="5">
<Value>FuelUsed</Value>
</Value>
<Value name="6">
<Value>HpLost</Value>
</Value>
<Value name="7">
<Value>Success</Value>
</Value>
<Value name="8">
<Value>TotalScore</Value>
</Value>
<Value name="9">
<Value>LogDate</Value>
</Value>
</Data>
<DataLocation>{%%PARENT}("MissionLogs")</DataLocation>
<DefaultData>MissionLogDefaultData</DefaultData>
<IdLocation>^dc.mu5k3t.storage.PlayerC("MissionLogs")</IdLocation>
<IndexLocation>^dc.mu5k3t.storage.MissionLogI</IndexLocation>
<StreamLocation>^dc.mu5k3t.storage.MissionLogS</StreamLocation>
<Type>%Storage.Persistent</Type>
}

}
