Class dc.mu5k3t.storage.MissionLog Extends (%Persistent, %JSON.Adaptor) [ CompileAfter = (dc.mu5k3t.storage.Player, dc.mu5k3t.storage.Mission) ]
{

/// Relationship (Parent): The Player owns this log physically.
Relationship Player As dc.mu5k3t.storage.Player [ Cardinality = parent, Inverse = MissionLogs ];

/// Relationship (One): Links to the Mission definition.
/// This is NOT a parent relationship, just a link.
Relationship Mission As dc.mu5k3t.storage.Mission [ Cardinality = one, Inverse = Logs ];

Property Timestamp As %TimeStamp [ InitialExpression = {$ZDATETIME($H, 3)} ];

// --- Code Data ---

Property SourceCode As %Stream.GlobalCharacter;

Property CodeSize As %Integer;

// --- Simulation Metrics ---

Property MineralsCollected As %Integer;

Property FuelUsed As %Integer;

Property HpLost As %Integer;

Property Success As %Boolean;

/// Final Calculated Score
Property TotalScore As %Numeric(SCALE = 2);

/// Index needed to find logs by Mission (since it's a relationship)
Index MissionIdx On Mission;

/// Index for Leaderboard: Grouped by Mission, Ordered by Score
Index LeaderboardIdx On (Mission, TotalScore);

Method CalculateScore()
{
        If '..Success { Set ..TotalScore = 0 Quit }
        
        Set score = (..MineralsCollected * 100)
        Set score = score - (..FuelUsed * 1.5) - (..HpLost * 5)
        
        Set codeBonus = 500 - ..CodeSize
        If codeBonus < 0 { Set codeBonus = 0 }
        
        Set ..TotalScore = score + codeBonus
}

Query GetHighScore(player As %String, mission As %String) As %SQLQuery(COMPILEMODE = "IMMEDIATE", ROWSPEC = "highScore:%String", SELECTMODE = "RUNTIME") [ SqlProc ]
{
        SELECT MAX(TotalScore) as highScore 
        FROM dc_mu5k3t_storage.MissionLog 
        WHERE Player = :player
        AND Mission = :mission 
        AND Success = 1
}

Query GetGlobalRanking(mission As %String, score As %String) As %SQLQuery(COMPILEMODE = "IMMEDIATE", ROWSPEC = "Rank:%Integer", SELECTMODE = "RUNTIME") [ SqlProc ]
{
        SELECT COUNT(*) + 1 As Rank FROM (
                SELECT Player, MAX(TotalScore) as MaxScore
                FROM dc_mu5k3t_storage.MissionLog
                WHERE Mission = :mission AND Success = 1
                GROUP BY Player
        ) WHERE MaxScore > :score
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
<Value>Timestamp</Value>
</Value>
<Value name="4">
<Value>SourceCode</Value>
</Value>
<Value name="5">
<Value>CodeSize</Value>
</Value>
<Value name="6">
<Value>MineralsCollected</Value>
</Value>
<Value name="7">
<Value>FuelUsed</Value>
</Value>
<Value name="8">
<Value>HpLost</Value>
</Value>
<Value name="9">
<Value>Success</Value>
</Value>
<Value name="10">
<Value>TotalScore</Value>
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
