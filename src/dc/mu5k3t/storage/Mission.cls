Class dc.mu5k3t.storage.Mission Extends (%Persistent, %JSON.Adaptor)
{

/// Unique Mission Code (e.g., "M1", "M2")
Property Code As %String(COLLATION = "EXACT") [ Required ];

Property Name As %String(MAXLEN = 100);

Property Description As %String(MAXLEN = 500);

/// JSON Objectives: {"minMinerals": 10, "returnBase": true}
Property Objectives As %String(MAXLEN = 1024);

Relationship Logs As dc.mu5k3t.storage.MissionLog [ Cardinality = many, Inverse = Mission ];

/// Relationship: A Mission is referenced by many Logs.
/// This allows us to call mission.Logs.Count() easily.
/// Unique Index for Code
Index CodeIndex On Code [ Unique ];

Query GetAllMissions(player As %String, mission As %String) As %SQLQuery(COMPILEMODE = "IMMEDIATE", ROWSPEC = "ID:%Integer,Code:%String,Name:%String,Description:%String", SELECTMODE = "RUNTIME") [ SqlProc ]
{
    SELECT ID, Code, Name, Description 
    FROM dc_mu5k3t_storage.Mission 
    ORDER BY Code
}

Storage Default
{
<Data name="MissionDefaultData">
<Value name="1">
<Value>%%CLASSNAME</Value>
</Value>
<Value name="2">
<Value>Code</Value>
</Value>
<Value name="3">
<Value>Name</Value>
</Value>
<Value name="4">
<Value>Description</Value>
</Value>
<Value name="5">
<Value>Objectives</Value>
</Value>
</Data>
<DataLocation>^dc.mu5k3t.storage.MissionD</DataLocation>
<DefaultData>MissionDefaultData</DefaultData>
<IdLocation>^dc.mu5k3t.storage.MissionD</IdLocation>
<IndexLocation>^dc.mu5k3t.storage.MissionI</IndexLocation>
<StreamLocation>^dc.mu5k3t.storage.MissionS</StreamLocation>
<Type>%Storage.Persistent</Type>
}

}
