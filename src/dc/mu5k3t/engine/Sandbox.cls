Class dc.mu5k3t.engine.Sandbox Extends %RegisteredObject
{

/// Compiles user code into a temporary class SILENTLY.
ClassMethod CompileUserCode(pSourceCode As %String, Output pClassName As %String) As %Status
{
    Set tSC = $$$OK
    Try {
        // 1. NORMALIZE CODE
        Set cleanCode = ..NormalizeCode(pSourceCode)
        Set cleanCode = ..MuteWrites(cleanCode)
        
        // 3. CONTEXT INJECTION & INDENTATION
        Set preamble = ""
        Set preamble = preamble _ "    // --- SYSTEM INJECTED CONTEXT ---" _ $$$NL
        Set preamble = preamble _ "    Set rover = context.rover" _ $$$NL
        Set preamble = preamble _ "    Set sensors = rover.sensors" _ $$$NL
        Set preamble = preamble _ "    Set memory = context.memory" _ $$$NL
        Set preamble = preamble _ "    // --- USER CODE START ---" _ $$$NL
        
        // Indenta o código (4 espaços)
        Set indentedCode = "    " _ $Replace(cleanCode, $$$NL, $$$NL_"    ")
        Set finalCode = preamble _ indentedCode
        
        // Generate unique class name
        Set pClassName = "dc.mu5k3t.temp.Session" _ $Job _ $Translate($ZTime($Piece($H,",",2)),":","")
        
        // Define Class & Method
        Set cDef = ##class(%Dictionary.ClassDefinition).%New(pClassName)
        Set cDef.Super = "%RegisteredObject"
        
        Set mDef = ##class(%Dictionary.MethodDefinition).%New(pClassName)
        Set mDef.Name = "OnTick"
        Set mDef.ClassMethod = 1
        Set mDef.FormalSpec = "context:%DynamicObject"
        
        Do mDef.Implementation.Write(finalCode)
        Do cDef.Methods.Insert(mDef)
        
        $$$ThrowOnError(cDef.%Save())
        
        // Compile "-d"
        Set flags = "ck-d"
        $$$ThrowOnError($System.OBJ.Compile(pClassName, flags))
        
    } Catch ex {
        Set tSC = ex.AsStatus()
    }
    Return tSC
}

/// Helper: Detects Write commands and comments them out inline.
/// Ex: "Set a=1 Write a" -> "Set a=1 // MUTE Write a"
/// Helper: Detects Write commands and comments them out inline.
/// Handles simple string quoting to avoid false positives inside strings.
ClassMethod MuteWrites(pCode As %String) As %String [ Language = python ]
{
    import re
    
    # Split code by quotes to isolate strings
    # ObjectScript strings use double quotes. Escaped quotes are "".
    # This split is a heuristic safe enough for this game context.
    parts = re.split('(")', pCode)
    
    in_string = False
    result = []
    
    # Regex to find write commands outside strings
    # Matches: Start of line or whitespace, followed by w/write/zw/zwrite, followed by word boundary
    pattern = r'(?im)(^|[ \t]+)(w|write|zw|zwrite)\b'
    
    for part in parts:
        if part == '"':
            in_string = not in_string
            result.append(part)
        elif in_string:
            # Don't touch content inside strings
            result.append(part)
        else:
            # Apply muting logic only to code parts
            # \1 = Original whitespace
            # // MUTE = The comment starter (kills the rest of the line)
            # \2 = The original command
            muted_part = re.sub(pattern, r'\1// MUTE \2', part)
            result.append(muted_part)
            
    return "".join(result)
}

/// Helper: Detects if code has a method signature and extracts the body.
ClassMethod NormalizeCode(pCode As %String) As %String [ Language = python ]
{
    import re
    signature_pattern = r'^\s*ClassMethod\s+OnTick.*'
    if re.search(signature_pattern, pCode, re.IGNORECASE | re.DOTALL):
        start_index = pCode.find('{')
        end_index = pCode.rfind('}')
        if start_index != -1 and end_index != -1 and end_index > start_index:
            return pCode[start_index+1:end_index]
    return pCode
}

/// Deletes the temporary class SILENTLY.
ClassMethod Cleanup(pClassName As %String)
{
    Do $System.OBJ.Delete(pClassName, "-d")
}

}
