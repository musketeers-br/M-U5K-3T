Class dc.mu5k3t.storage.Player Extends (%Persistent, %JSON.Adaptor)
{

/// User Identity
Property Username As %String(MAXLEN = 100) [ Required ];

Property CommunityURL As %String(MAXLEN = 255);

Property JoinDate As %TimeStamp [ InitialExpression = {$ZDATETIME($H, 3)} ];

/// Relationship: A Player OWNS their logs (Parent/Child storage).
Relationship MissionLogs As dc.mu5k3t.storage.MissionLog [ Cardinality = children, Inverse = Player ];

/// Unique Index on Username
Index UserIdx On Username [ Unique ];

/// Helper method
ClassMethod GetOrCreate(pUser As %String) As dc.mu5k3t.storage.Player
{
        Set tObj = ..UserIdxOpen(pUser)
        If '$IsObject(tObj) {
            Set tObj = ..%New()
            Set tObj.Username = pUser
            Set tObj.CommunityURL = "https://community.intersystems.com/user/"_pUser
            Do tObj.%Save()
        }
        Quit tObj
}

Storage Default
{
<Data name="PlayerDefaultData">
<Value name="1">
<Value>%%CLASSNAME</Value>
</Value>
<Value name="2">
<Value>Username</Value>
</Value>
<Value name="3">
<Value>CommunityURL</Value>
</Value>
<Value name="4">
<Value>JoinDate</Value>
</Value>
</Data>
<DataLocation>^dc.mu5k3t.storage.PlayerD</DataLocation>
<DefaultData>PlayerDefaultData</DefaultData>
<IdLocation>^dc.mu5k3t.storage.PlayerD</IdLocation>
<IndexLocation>^dc.mu5k3t.storage.PlayerI</IndexLocation>
<StreamLocation>^dc.mu5k3t.storage.PlayerS</StreamLocation>
<Type>%Storage.Persistent</Type>
}

}
