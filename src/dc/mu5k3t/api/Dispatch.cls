Class dc.mu5k3t.api.Dispatch Extends %CSP.REST
{

Parameter HandleCorsRequest = 0;

Parameter CONTENTTYPE = "application/json";

XData UrlMap [ XMLNamespace = "http://www.intersystems.com/urlmap" ]
{
<Routes>
    <Route Url="/auth/login" Method="POST" Call="Login"  />
    <Route Url="/dashboard/:user" Method="GET" Call="GetDashboard"   />
    <Route Url="/deploy" Method="POST" Call="ReceiveDeploy"  />
    <Route Url="/map/:mission/:mode" Method="GET" Call="GetMapData" />

</Routes>
}

ClassMethod GetMapData(mission As %String, mode As %String) As %Status
{
    Set %response.ContentType = ..#CONTENTTYPE
    Set tSC = $$$OK
    Try {
        $$$ThrowOnError(##class(dc.mu5k3t.model.Map).GetMap(mission, mode, .response))
        Write response.%ToJSON()
    } Catch ex {
        Set tSC=ex.AsStatus()
    }
    Return tSC
}

ClassMethod Login() As %Status
{
    Set %response.ContentType = ..#CONTENTTYPE
    Set tSC = $$$OK
    Try {
        Set %response.ContentType = ..#CONTENTTYPE
        Set payload = {}.%FromJSON(%request.Content)
        $$$ThrowOnError(##class(dc.mu5k3t.model.Player).Login(payload.username, .response))
    } Catch ex {
        Set tSC=ex.AsStatus()
    }
    Return tSC
}

ClassMethod GetDashboard(user As %String) As %Status
{
    Set %response.ContentType = ..#CONTENTTYPE
    Set tSC = $$$OK
    Try {
        $$$ThrowOnError(##class(dc.mu5k3t.model.Player).Dashboard(user, .response))
        Write response.%ToJSON()
    } Catch ex {
        Set tSC=ex.AsStatus()
    }
    Return tSC
}

}
