Class tests.dc.Simul Extends %RegisteredObject
{

/// Roda os 3 cenários de teste no Terminal
/// Do ##class(Test.Debug).Run()
ClassMethod Run()
{
    Write !, "=== INICIANDO BATERIA DE TESTES DE DEPLOY ===",!
    
    // 1. Teste de Vitória (Código Válido)
    Write !, "📡 TIPO 1: MISSÃO PADRÃO (Tentativa de Vitória)",!
    Do ..SimulateDeploy("VALID")
    
    // 2. Teste de Violação (Hacker)
    Write !, "💀 TIPO 2: VIOLAÇÃO DE SEGURANÇA (Hacker)",!
    Do ..SimulateDeploy("HACK")
    
    // 3. Teste de Quebra (Erro de Runtime)
    Write !, "💥 TIPO 3: FALHA CRÍTICA (Erro de Sintaxe/Runtime)",!
    Do ..SimulateDeploy("CRASH")
    
    Write !, "=== TESTES CONCLUÍDOS ===",!
}

ClassMethod SimulateDeploy(type As %String)
{
    Set user = "cmd-henry"
    Set mission = "M1"
    Set code = ""
    
    // --- DEFINIÇÃO DOS CENÁRIOS ---
    
    // CENÁRIO 1: Código Válido (Anda e Vira se bater)
    If type = "VALID" {
        Set code = " // Lógica Simples de Rover" _
                " Set sensors = context.rover.sensors" _
                " If sensors.front = ""OBSTACLE"" { " _
                "    Do context.action.%Set(""turn"", ""right"") " _
                " } Else { " _
                "    Do context.action.%Set(""move"", """") " _
                " }"
    }
    
    // CENÁRIO 2: Hacker (Tenta acessar o Sistema)
    If type = "HACK" {
        Set code = " Do $System.OBJ.ShowFlags()" // PROIBIDO!
    }
    
    // CENÁRIO 3: Crash (Divisão por Zero)
    If type = "CRASH" {
        Set code = " Set x = 1 / 0 " // KABOOM!
    }
    
    // --- MONTAGEM DO PAYLOAD ---
    Set payload = {}
    Set payload.username = user
    Set payload.missionId = mission
    Set payload.code = code
    Set payloadStr = payload.%ToJSON()
    
    // --- EXECUÇÃO (Simulando o WorkQueue) ---
    Set ticket = $System.Util.CreateGUID()
    Write "🎫 Ticket Gerado: ", ticket, !
    
    // Chama o Worker DIRETAMENTE (Sem WorkQueueMgr para ver o log aqui mesmo)
    Set tSC = ##class(dc.mu5k3t.model.Player).MissionDeployWorker(payloadStr, ticket)
    
    If $$$ISERR(tSC) {
        Write "❌ ERRO NO WORKER: ", $System.Status.GetErrorText(tSC), !
        Quit
    }
    
    // --- LEITURA DO BUFFER ---
    Set jsonResult = ""
    Set errorMsg = ""
    
    // Lê o resultado da "Caixa de Correio" segura
    Set tSCRead = ##class(dc.mu5k3t.storage.WorkBuffer).ReadAndDestroy(ticket, .jsonResult, .errorMsg)
    
    If $$$ISERR(tSCRead) {
        Write "❌ ERRO AO LER BUFFER: ", $System.Status.GetErrorText(tSCRead), !
        Quit
    }
    
    If errorMsg'="" {
            Write "⚠️ WORKER REPORTOU ERRO: ", errorMsg, !
            // Se for erro de método inexistente, mostramos detalhes
            If jsonResult'="" Write "   DETALHES: ", jsonResult, !
        } Else {
            Write "✅ SUCESSO! JSON RETORNADO:", !
            Set obj = {}.%FromJSON(jsonResult)
            Write "   STATUS: ", obj.status, !
            
            If obj.finalScore'="" Write "   SCORE:  ", obj.finalScore, !
            
            // CORREÇÃO AQUI: Verificar se timeline existe antes de acessar %Size
            If $IsObject(obj.timeline) {
                Write "   STEPS:  ", obj.timeline.%Size(), !
            } Else {
                Write "   STEPS:  (N/A)", !
            }
            
            If obj.error'="" Write "   ERRO LOGICO: ", obj.error, !
            If obj.message'="" Write "   MENSAGEM: ", obj.message, !
        }
        Write "--------------------------------------------------",!
}

}
