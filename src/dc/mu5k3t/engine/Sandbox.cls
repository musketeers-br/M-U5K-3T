Class dc.mu5k3t.engine.Sandbox Extends %RegisteredObject
{

/// Compiles user code into a temporary class SILENTLY.
ClassMethod CompileUserCode(pSourceCode As %String, Output pClassName As %String) As %Status
{
    Set tSC = $$$OK
    Try {
        // 1. NORMALIZE CODE
        // Checks if the user sent the full ClassMethod signature or just the body.
        // If full signature is found, strips it to extract only the logic body.
        Set cleanCode = ..NormalizeCode(pSourceCode)
        
        // Generate unique class name
        Set pClassName = "dc.mu5k3t.temp.Session" _ $Job _ $Translate($ZTime($Piece($H,",",2)),":","")
        
        // Define Class
        Set cDef = ##class(%Dictionary.ClassDefinition).%New(pClassName)
        Set cDef.Super = "%RegisteredObject"
        
        // Define OnTick Method
        Set mDef = ##class(%Dictionary.MethodDefinition).%New(pClassName)
        Set mDef.Name = "OnTick"
        Set mDef.ClassMethod = 1
        Set mDef.FormalSpec = "context:%DynamicObject"
        
        // Inject the normalized code (Body only)
        Do mDef.Implementation.Write(cleanCode)
        Do cDef.Methods.Insert(mDef)
        
        // Save
        $$$ThrowOnError(cDef.%Save())
        
        // Compile with "-d" (No Display) to prevent stdout pollution
        Set flags = "ck-d"
        $$$ThrowOnError($System.OBJ.Compile(pClassName, flags))
        
    } Catch ex {
        Set tSC = ex.AsStatus()
    }
    Return tSC
}

/// Helper: Detects if code has a method signature and extracts the body.
ClassMethod NormalizeCode(pCode As %String) As %String [ Language = python ]
{
    import re
    
    # Pattern to detect "ClassMethod OnTick..." (Case Insensitive)
    # \s* matches potential leading whitespace
    # ClassMethod matches the keyword
    # .*? matches the arguments part
    signature_pattern = r'^\s*ClassMethod\s+OnTick.*'
    
    if re.search(signature_pattern, pCode, re.IGNORECASE | re.DOTALL):
        # User sent the full wrapper. We need to extract what is inside the outer { }
        
        # Find the first opening brace '{'
        start_index = pCode.find('{')
        
        # Find the LAST closing brace '}' (to handle nested blocks correctly)
        end_index = pCode.rfind('}')
        
        if start_index != -1 and end_index != -1 and end_index > start_index:
            # Return everything strictly BETWEEN the braces
            return pCode[start_index+1:end_index]
            
    # If no signature detected, assume it is already just the body
    return pCode
}

/// Deletes the temporary class SILENTLY.
ClassMethod Cleanup(pClassName As %String)
{
    // "-d" prevents deletion logs
    Do $System.OBJ.Delete(pClassName, "-d")
}

}
