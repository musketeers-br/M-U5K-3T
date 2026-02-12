Class dc.mu5k3t.storage.WorkBuffer Extends %Persistent
{

/// Unique Identifier for the transaction
Property TicketID As %String(MAXLEN = 50) [ Required ];

/// Index to allow fast retrieval by TicketID
Index IdxTicket On TicketID [ Unique ];

/// The simulation result (can be huge, so we use Stream)
Property JsonData As %Stream.GlobalCharacter;

/// Status of the operation (SUCCESS, ERROR)
Property Status As %String;

/// Error message if something exploded
Property ErrorMessage As %String(MAXLEN = 500);

/// Helper to Write data safely from the Worker
ClassMethod WriteResult(pTicket As %String, pJson As %String, pStatus As %String = "SUCCESS", pError As %String = "") As %Status
{
    Set tSC = $$$OK
    Try {
        // Create new buffer entry
        Set buffer = ..%New()
        Set buffer.TicketID = pTicket
        Set buffer.Status = pStatus
        Set buffer.ErrorMessage = pError
        
        // Write JSON string to Stream (handling chunking automatically)
        If pJson'="" {
            Do buffer.JsonData.Write(pJson)
        }
        
        $$$ThrowOnError(buffer.%Save())
    } Catch ex {
        Set tSC = ex.AsStatus()
    }
    Return tSC
}

/// Helper to Read and Destroy data from the Dispatcher
ClassMethod ReadAndDestroy(pTicket As %String, Output pJson As %String, Output pError As %String) As %Status
{
    Set tSC = $$$OK
    Set pJson = ""
    Set pError = ""
    Try {
        // Open by Ticket ID
        Set buffer = ##class(dc.mu5k3t.storage.WorkBuffer).IdxTicketOpen(pTicket)
        If '$IsObject(buffer) {
            Throw $$$ERROR(5002, "WorkBuffer ticket not found: " _ pTicket)
        }
        
        Set pError = buffer.ErrorMessage
        
        // Read Stream content back to String
        // Note: If JSON > 3.6MB, this .Read() might need looping, 
        // but for this game, the timeline usually fits in memory.
        If buffer.JsonData.Size > 0 {
            Do buffer.JsonData.Rewind()
            Set pJson = buffer.JsonData.Read($$$MaxStringLength)
        }
        
        // DESTROY after reading (Garbage Collection)
        Do ##class(dc.mu5k3t.storage.WorkBuffer).%DeleteId(buffer.%Id())
        
    } Catch ex {
        Set tSC = ex.AsStatus()
    }
    Return tSC
}

Storage Default
{
<Data name="WorkBufferDefaultData">
<Value name="1">
<Value>%%CLASSNAME</Value>
</Value>
<Value name="2">
<Value>TicketID</Value>
</Value>
<Value name="3">
<Value>JsonData</Value>
</Value>
<Value name="4">
<Value>Status</Value>
</Value>
<Value name="5">
<Value>ErrorMessage</Value>
</Value>
</Data>
<DataLocation>^dc.mu5k3t.storage.WorkBufferD</DataLocation>
<DefaultData>WorkBufferDefaultData</DefaultData>
<IdLocation>^dc.mu5k3t.storage.WorkBufferD</IdLocation>
<IndexLocation>^dc.mu5k3t.storage.WorkBufferI</IndexLocation>
<StreamLocation>^dc.mu5k3t.storage.WorkBufferS</StreamLocation>
<Type>%Storage.Persistent</Type>
}

}
