Class dc.mu5k3t.storage.MapDefinition Extends (%Persistent, %JSON.Adaptor)
{

/// Link to the Mission Code (M1, M2, M3)
Property MissionCode As %String [ Required ];

/// Mode: "SIMULATION" or "DEPLOY"
Property Mode As %String(VALUELIST = ",SIMULATION,DEPLOY") [ Required ];

/// The size of the grid (10, 25, 50, etc.)
Property GridSize As %Integer [ Required ];

/// The generation algorithm to use
Property Algorithm As %String(VALUELIST = ",OPEN_FIELD,CORRIDOR,HAZARD_CLUSTERS");

/// Store the JSON Layout Data (Streams are better for large CLOBs)
Property LayoutData As %Stream.GlobalCharacter;

/// Composite Index to find specific map config quickly
Index ConfigIdx On (MissionCode, Mode) [ Unique ];

Parameter SQLTABLENAME = "MapDefinition";

Storage Default
{
<Data name="MapDefinitionDefaultData">
<Value name="1">
<Value>%%CLASSNAME</Value>
</Value>
<Value name="2">
<Value>MissionCode</Value>
</Value>
<Value name="3">
<Value>Mode</Value>
</Value>
<Value name="4">
<Value>GridSize</Value>
</Value>
<Value name="5">
<Value>Algorithm</Value>
</Value>
<Value name="6">
<Value>LayoutData</Value>
</Value>
</Data>
<DataLocation>^dc.mu5k3t.st4AFC.MapDefinitionD</DataLocation>
<DefaultData>MapDefinitionDefaultData</DefaultData>
<IdLocation>^dc.mu5k3t.st4AFC.MapDefinitionD</IdLocation>
<IndexLocation>^dc.mu5k3t.st4AFC.MapDefinitionI</IndexLocation>
<StreamLocation>^dc.mu5k3t.st4AFC.MapDefinitionS</StreamLocation>
<Type>%Storage.Persistent</Type>
}

}
