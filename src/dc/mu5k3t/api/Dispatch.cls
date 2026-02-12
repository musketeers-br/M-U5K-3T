Class dc.mu5k3t.api.Dispatch Extends %CSP.REST
{

/// Disable CORS handling by IRIS (handled by Web Gateway or Frontend proxy if needed)
Parameter HandleCorsRequest = 0;

/// Default Content-Type for all responses
Parameter CONTENTTYPE = "application/json";

XData UrlMap [ XMLNamespace = "http://www.intersystems.com/urlmap" ]
{
<Routes>
    <Route Url="/auth/login" Method="POST" Call="Login" />
    
    <Route Url="/dashboard/:user" Method="GET" Call="GetDashboard" />
    
    <Route Url="/deploy" Method="POST" Call="ReceiveDeploy" />
    
    <Route Url="/map/:mission/:mode" Method="GET" Call="GetMapData" />
</Routes>
}

/// POST /auth/login
/// Handles user login by delegating to Player Model
ClassMethod Login() As %Status
{
    Set %response.ContentType = ..#CONTENTTYPE
    Set tSC = $$$OK
    Try {
        Set payload = {}.%FromJSON(%request.Content)
        // Delegates logic to Player Model
        $$$ThrowOnError(##class(dc.mu5k3t.model.Player).Login(payload.username, .response))
        Write response.%ToJSON()
    } Catch ex {
        Set tSC=ex.AsStatus()
        Set err = {"error": ($System.Status.GetErrorText(tSC))}
        Write err.%ToJSON()
    }
    Return tSC
}

/// GET /dashboard/:user
/// Retrieves mission status and rankings for the user
ClassMethod GetDashboard(user As %String) As %Status
{
    Set %response.ContentType = ..#CONTENTTYPE
    Set tSC = $$$OK
    Try {
        // Delegates logic to Player Model
        $$$ThrowOnError(##class(dc.mu5k3t.model.Player).Dashboard(user, .response))
        Write response.%ToJSON()
    } Catch ex {
        Set tSC=ex.AsStatus()
        // Fail-safe response to prevent frontend crash
        Set err = { "user": (user), "missions": [], "error": ($System.Status.GetErrorText(tSC)) }
        Write err.%ToJSON()
    }
    Return tSC
}

/// GET /map/:mission/:mode
/// Retrieves map configuration (Simulation or Deploy mode)
ClassMethod GetMapData(mission As %String, mode As %String) As %Status
{
    Set %response.ContentType = ..#CONTENTTYPE
    Set tSC = $$$OK
    Try {
        // Delegates logic to Map Model
        $$$ThrowOnError(##class(dc.mu5k3t.model.Map).GetMap(mission, mode, .response))
        Write response.%ToJSON()
    } Catch ex {
        Set tSC=ex.AsStatus()
        Set err = {"error": ($System.Status.GetErrorText(tSC))}
        Write err.%ToJSON()
    }
    Return tSC
}

/// POST /deploy
/// /// Receives code, runs simulation (with I/O redirection), and handles response.
/// Dispatches to Worker via Class Storage for max safety
ClassMethod ReceiveDeploy() As %Status
{
    Set %response.ContentType = ..#CONTENTTYPE
    Set tSC = $$$OK
    
    Try {
        // 1. READ PAYLOAD SAFELY
        Set payloadString = ""
        If $IsObject(%request.Content) && (%request.Content.Size > 0) {
            Do %request.Content.Rewind() 
            Set rawData = %request.Content.Read($$$MaxStringLength)
            Set payloadString = $ZCVT(rawData, "I", "UTF8")
        }
        
        If payloadString = "" Throw $$$ERROR(5002, "Empty Request Body")
        
        // 2. Queue Worker
        Set ticketID = $System.Util.CreateGUID()
        Set mgr = ##class(%SYSTEM.WorkMgr).%New()
        Set tSC = mgr.Queue("##class(dc.mu5k3t.model.Player).MissionDeployWorker", payloadString, ticketID)
        $$$ThrowOnError(tSC)
        
        // 3. Wait
        Set tSC = mgr.WaitForComplete()
        $$$ThrowOnError(tSC)
        
        // 4. RETRIEVE FROM BUFFER CLASS
        Set jsonResult = ""
        Set errorMsg = ""
        Set tSCBuffer = ##class(dc.mu5k3t.storage.WorkBuffer).ReadAndDestroy(ticketID, .jsonResult, .errorMsg)
        
        If $$$ISERR(tSCBuffer) Throw tSCBuffer
        
        Do %response.Reset()
        Set %response.CharSet = "utf-8"
        Set %response.ContentType = ..#CONTENTTYPE
        // -----------------------------------

        If errorMsg'="" {
            Set err = {}
            Set err.status = "WORKER_ERROR"
            Set err.message = errorMsg
            Write err.%ToJSON()
        } Else {
            Write jsonResult
        }
        
    } Catch ex {
        // Limpeza de emergência também no Catch
        Do %response.Reset()
        Set %response.CharSet = "utf-8"
        Set %response.ContentType = ..#CONTENTTYPE
        
        Set tSC=ex.AsStatus()
        Set err = {}
        Set err.status = "SERVER_ERROR"
        Set err.message = $System.Status.GetErrorText(tSC)
        Write err.%ToJSON()
    }
    Return tSC
}

ClassMethod SanitizeCode(pCode As %String) As %String [ Language = python ]
{
    import re
    pattern = r'(?im)(^|\s)(w|write|zw|zwrite)\b'
    sanitized = re.sub(pattern, r'\1// MUTE \2', pCode)
    return sanitized
}

}
