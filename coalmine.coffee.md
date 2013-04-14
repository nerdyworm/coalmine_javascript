JavaScript Connector for Coalmine
=================================

We start by creating a class, Coalmine.  This is not publicly accessible, but later an object, `coalmine`, is added to the global scope.

Of note here is the pseudo-constant `MSIE_MAX_URL_LENGTH`, set to 2048 bytes.  The maximum URL length is technically 2083 bytes (see this [knowledge base article](http://support.microsoft.com/kb/208427)), but we'll play it safe and limit all URLs to 2 KB.

    class Coalmine
      URL_BASE: ":scheme://:host/events?signature=:signature&json=:json"
      MSIE_MAX_URL_LENGTH: 2048
      TRUNCATED_SEQ: "(...)"
      
      class Configuration
        constructor: ->
          @scheme = "https"
          @host = "coalmineapp.com"
          @enabledEnvironments = ["production", "staging"]
          @signature = null
          @version = null
          @environment = null
          @parameters = null
          @ipAddress = null
          @method = null
          @userId = null
          @customVariables = {}
      
      constructor: ->
        @config = new Configuration
        @errors = []
        @crit = @critical
        @err = @error
        @warn = @warning

The `configure` method emulates how configuration works in other connectors, for the sake of consistency.

      # Configures instance
      configure: (callback) ->
        callback @config

The following methods are convenience logging methods.

      critical: (message, additionalData) ->
        additionalData.severity = "critical"
        @notify message, additionalData
      
      error: (message, additionalData) ->
        additionalData.severity = "error"
        @notify message, additionalData
      
      warning: (message, additionalData) ->
        additionalData.severity = "warning"
        @notify message, additionalData
      
      info: (message, additionalData) ->
        additionalData.severity = "info"
        @notify message, additionalData
      
      debug: (message, additionalData) ->
        additionalData.severity = "debug"
        @notify message, additionalData

We set custom variables here, to later be shown on the "Application" tab.

      setCustomVariable: (key, value) ->
        @config.customVariables[key] = value

Here we notify Coalmine of an error.

The `message` parameter may be a string or an exception.

The `additionalData` parameter is used to pass additional exception data to Coalmine.  JavaScript exceptions are pretty limited, so we can only capture URL and line number.

      notify: (message, additionalData) ->
        e = null
        if typeof message is "object"
          e = message
          message = e.message
        
        error = @createNotification message, additionalData
        @errors.push error
        
        sendable = @config.environment in @config.enabledEnvironments

If the error is sendable (that is, if the environment is set to one of the enabled environments), we create a `<script>` tag with a dynamic URL that points to Coalmine.

        if sendable
          src = @createSafeUrl error
          return unless src  # This should only occur in IE in rare situations
          script = document.createElement "script"
          script.src = src
          html = document.documentElement
          document.body.appendChild script if document.body
          true
        else
          error

This method creates a URL that's safe to submit in Internet Explorer.  A good chunk of the work this connector must do is a direct result of IE's URL length restriction.

      createSafeUrl: (error) ->
        url = @createUrl error

If we're not using Internet Explorer, or we are but the URL length is shorter than IE's limit, we're good to go.

        isMsie = error.user_agent.indexOf("MSIE") > -1
        return url unless error.user_agent? and isMsie
        
        excess = url.length - @MSIE_MAX_URL_LENGTH
        return url if excess <= 0

The URL is too long for IE, so one or more of these are probably the culprits.

First, weigh them by **percentage of excess URL characters * debugging importance**, then sort them according to weight and truncate where possible.

The weighting isn't exactly scientific, but it's an attempt to preserve important attributes if possible.

        longParameters = [
          {name: "user_agent",  weight: 0},
          {name: "stack_trace", weight: 0},
          {name: "parameters",  weight: 0},
          {name: "cookies",     weight: 0},
          {name: "referrer",    weight: 0}
        ]
        
        excess = url.length - @MSIE_MAX_URL_LENGTH
        totalLength = 0
        
        for longParameter, i in longParameters
          parameter = error[longParameter.name]
          continue unless parameter?
          longParameter.weight = (parameter.length / excess) * (i + 1)
          totalLength += parameter.length

If the total length of the "long parameters" is longer than the overage, we're in good shape.  This means we can cut some, starting with the worst offenders, and send the error to Coalmine as desired.

Sort the long parameters by weight descending (favoring user agent, stack trace, etc.).

        if totalLength >= excess
          longParameters.sort (a, b) -> b.weight - a.weight
          
          for longParameter in longParameters
            excess = url.length - @MSIE_MAX_URL_LENGTH
            return url if excess <= 0
            continue if longParameter.weight <= 0
            
            parameter = error[longParameter.name]
            newLength = parameter.length - excess - @TRUNCATED_SEQ.length
            newLength = 0 if newLength < 0
            

This isn't exact; because of URL encoding, the resulting URL will always be shorter than `MSIE_MAX_URL_LENGTH`.  Better safe than sorry!

Also, we add a truncation sequence to the end of a truncated parameter to indicate that it has been truncated.  That way you don't have parameters that end suddenly without warni

            error[longParameter.name] = parameter.substring(0, newLength) + @TRUNCATED_SEQ
            
            url = @createUrl error

At this point it's possible, though unlikely, that the URL may still be too long, but just send it and hope for the best.

        url
  
Here we create a notification URL by replacing placeholder strings.

      createUrl: (error) ->
        url = @URL_BASE
        url = url.replace ":scheme", @config.scheme
        url = url.replace ":host", @config.host
        url = url.replace ":signature", @config.signature
        url = url.replace ":json", encodeURIComponent JSON.stringify error
        url
  
This method creates a notification object.  It's pretty self-explanatory: assign each value to an object key, explicitly converting values to strings when they come from the browser.

      createNotification: (message, additionalData) ->
        additionalData = {} unless typeof additionalData is "object"
        
        url = line = severity = ""
        url = "" + additionalData.url if "url" of additionalData
        line = "" + additionalData.line if "line" of additionalData
        severity = "" + additionalData.severity if "severity" of additionalData
        
        version = @config.version
        version = "" + version unless version
        
        notification = {
          # Application
          version: version
          app_environment: @config.environment
          user_id: "" + @config.userId
          application: @config.customVariables
          
          # Request
          url: @getRequestUrl(url)
          method: @config.method
          parameters: @config.parameters or @getParameters(url)  # From server
          ip_address: @config.ipAddress
          hostname: window.location.hostname or ""
          user_agent: navigator.userAgent or ""
          referrer: document.referrer or ""
          cookies: document.cookie or ""
          
          # Error
          severity: severity or "error"
          stack_trace: @getStackTrace(arguments)
          message: message or ""
          line_number: line or ""
        }
        
        for key of notification
          delete notification.key unless notification.key
        
        notification

Here we return the request URL.  The logic is because browsers send back some weird values for URL sometimes.

      getRequestUrl: (url) ->
        if url? and typeof url is "string"
          url
        else
          window.location.href

This method returns all GET parameters, including both query string parameters (`?foo=bar`) and Google-style anchor parameters (`#foo=bar`).

      getParameters: (url) ->
        url = @getRequestUrl url
        parameters = ""
        
        if url
          # Query string parameters
          unless url.indexOf("?") is -1
            parameters = url
              .replace(/.*\?/, "")
              .replace(/#.*/, "")
              .replace(/&$/, "")
          
          # Google-style anchor parameters
          unless url.indexOf("#") is -1
            anchor = url.replace /.*#/, ""
            if /(?:.+=[^\&]*)+/.test anchor
              anchor = anchor.replace /&$/, ""
              parameters += "&" if parameters
              parameters += anchor
        
        parameters

Here we return a stack trace.  Note that message can be either a string or an exception object.

      getStackTrace: (message, url, line) ->
        stackTrace = ""
        if typeof message is "object"
          stackTrace = printStackTrace e: message
        else
          stackTrace = printStackTrace()
        stackTrace.join "\n"

These methods are used primarily for testing purposes.

      getErrors: -> @errors
      
      # Has a certain error message been logged?
      hasMessage: (string) ->
        for error in @errors
          return true unless error.message.indexOf(string) is -1
        false

Assign an instance of this class to the global scope.  The class itself is inaccessible directly to avoid polluting the global namespace further.

    window.coalmine = new Coalmine

We need to add JSON support for older browsers, so we'll use [json2.js](https://github.com/douglascrockford/JSON-js) Douglas Crockford's JSON parsing class, which is in the public domain.

    `if(typeof JSON!=="object"){JSON={}}(function(){"use strict";function f(n){return n<10?"0"+n:n}if(typeof Date.prototype.toJSON!=="function"){Date.prototype.toJSON=function(key){return isFinite(this.valueOf())?this.getUTCFullYear()+"-"+f(this.getUTCMonth()+1)+"-"+f(this.getUTCDate())+"T"+f(this.getUTCHours())+":"+f(this.getUTCMinutes())+":"+f(this.getUTCSeconds())+"Z":null};String.prototype.toJSON=Number.prototype.toJSON=Boolean.prototype.toJSON=function(key){return this.valueOf()}}var cx=/[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,escapable=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,gap,indent,meta={"\b":"\\b","	":"\\t","\n":"\\n","\f":"\\f","\r":"\\r",'"':'\\"',"\\":"\\\\"},rep;function quote(string){escapable.lastIndex=0;return escapable.test(string)?'"'+string.replace(escapable,function(a){var c=meta[a];return typeof c==="string"?c:"\\u"+("0000"+a.charCodeAt(0).toString(16)).slice(-4)})+'"':'"'+string+'"'}function str(key,holder){var i,k,v,length,mind=gap,partial,value=holder[key];if(value&&typeof value==="object"&&typeof value.toJSON==="function"){value=value.toJSON(key)}if(typeof rep==="function"){value=rep.call(holder,key,value)}switch(typeof value){case"string":return quote(value);case"number":return isFinite(value)?String(value):"null";case"boolean":case"null":return String(value);case"object":if(!value){return"null"}gap+=indent;partial=[];if(Object.prototype.toString.apply(value)==="[object Array]"){length=value.length;for(i=0;i<length;i+=1){partial[i]=str(i,value)||"null"}v=partial.length===0?"[]":gap?"[\n"+gap+partial.join(",\n"+gap)+"\n"+mind+"]":"["+partial.join(",")+"]";gap=mind;return v}if(rep&&typeof rep==="object"){length=rep.length;for(i=0;i<length;i+=1){if(typeof rep[i]==="string"){k=rep[i];v=str(k,value);if(v){partial.push(quote(k)+(gap?": ":":")+v)}}}}else{for(k in value){if(Object.prototype.hasOwnProperty.call(value,k)){v=str(k,value);if(v){partial.push(quote(k)+(gap?": ":":")+v)}}}}v=partial.length===0?"{}":gap?"{\n"+gap+partial.join(",\n"+gap)+"\n"+mind+"}":"{"+partial.join(",")+"}";gap=mind;return v}}if(typeof JSON.stringify!=="function"){JSON.stringify=function(value,replacer,space){var i;gap="";indent="";if(typeof space==="number"){for(i=0;i<space;i+=1){indent+=" "}}else if(typeof space==="string"){indent=space}rep=replacer;if(replacer&&typeof replacer!=="function"&&(typeof replacer!=="object"||typeof replacer.length!=="number")){throw new Error("JSON.stringify")}return str("",{"":value})}}if(typeof JSON.parse!=="function"){JSON.parse=function(text,reviver){var j;function walk(holder,key){var k,v,value=holder[key];if(value&&typeof value==="object"){for(k in value){if(Object.prototype.hasOwnProperty.call(value,k)){v=walk(value,k);if(v!==undefined){value[k]=v}else{delete value[k]}}}}return reviver.call(holder,key,value)}text=String(text);cx.lastIndex=0;if(cx.test(text)){text=text.replace(cx,function(a){return"\\u"+("0000"+a.charCodeAt(0).toString(16)).slice(-4)})}if(/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,"@").replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,"]").replace(/(?:^|:|,)(?:\s*\[)+/g,""))){j=eval("("+text+")");return typeof reviver==="function"?walk({"":j},""):j}throw new SyntaxError("JSON.parse")}}})();`

We also need a way to construct a stack trace, since vanilla JavaScript doesn't have a simple, built-in way to do this.  We'll use [stacktrace.js](https://github.com/eriwen/javascript-stacktrace/), which is also in the public domain.  Thanks to Wendelin, Smith, Dachary, Euphrosine, Kinsey, and Homyakov.

    `function printStackTrace(options){options=options||{guess:true};var ex=options.e||null,guess=!!options.guess;var p=new printStackTrace.implementation,result=p.run(ex);return guess?p.guessAnonymousFunctions(result):result}printStackTrace.implementation=function(){};printStackTrace.implementation.prototype={run:function(ex,mode){ex=ex||this.createException();mode=mode||this.mode(ex);if(mode==="other"){return this.other(arguments.callee)}else{return this[mode](ex)}},createException:function(){try{this.undef()}catch(e){return e}},mode:function(e){if(e["arguments"]&&e.stack){return"chrome"}else if(typeof e.message==="string"&&typeof window!=="undefined"&&window.opera){if(!e.stacktrace){return"opera9"}if(e.message.indexOf("\n")>-1&&e.message.split("\n").length>e.stacktrace.split("\n").length){return"opera9"}if(!e.stack){return"opera10a"}if(e.stacktrace.indexOf("called from line")<0){return"opera10b"}return"opera11"}else if(e.stack){return"firefox"}return"other"},instrumentFunction:function(context,functionName,callback){context=context||window;var original=context[functionName];context[functionName]=function instrumented(){callback.call(this,printStackTrace().slice(4));return context[functionName]._instrumented.apply(this,arguments)};context[functionName]._instrumented=original},deinstrumentFunction:function(context,functionName){if(context[functionName].constructor===Function&&context[functionName]._instrumented&&context[functionName]._instrumented.constructor===Function){context[functionName]=context[functionName]._instrumented}},chrome:function(e){var stack=(e.stack+"\n").replace(/^\S[^\(]+?[\n$]/gm,"").replace(/^\s+(at eval )?at\s+/gm,"").replace(/^([^\(]+?)([\n$])/gm,"{anonymous}()@$1$2").replace(/^Object.<anonymous>\s*\(([^\)]+)\)/gm,"{anonymous}()@$1").split("\n");stack.pop();return stack},firefox:function(e){return e.stack.replace(/(?:\n@:0)?\s+$/m,"").replace(/^\(/gm,"{anonymous}(").split("\n")},opera11:function(e){var ANON="{anonymous}",lineRE=/^.*line (\d+), column (\d+)(?: in (.+))? in (\S+):$/;var lines=e.stacktrace.split("\n"),result=[];for(var i=0,len=lines.length;i<len;i+=2){var match=lineRE.exec(lines[i]);if(match){var location=match[4]+":"+match[1]+":"+match[2];var fnName=match[3]||"global code";fnName=fnName.replace(/<anonymous function: (\S+)>/,"$1").replace(/<anonymous function>/,ANON);result.push(fnName+"@"+location+" -- "+lines[i+1].replace(/^\s+/,""))}}return result},opera10b:function(e){var ANON="{anonymous}",lineRE=/^(.*)@(.+):(\d+)$/;var lines=e.stacktrace.split("\n"),result=[];for(var i=0,len=lines.length;i<len;i++){var match=lineRE.exec(lines[i]);if(match){var fnName=match[1]?match[1]+"()":"global code";result.push(fnName+"@"+match[2]+":"+match[3])}}return result},opera10a:function(e){var ANON="{anonymous}",lineRE=/Line (\d+).*script (?:in )?(\S+)(?:: In function (\S+))?$/i;var lines=e.stacktrace.split("\n"),result=[];for(var i=0,len=lines.length;i<len;i+=2){var match=lineRE.exec(lines[i]);if(match){var fnName=match[3]||ANON;result.push(fnName+"()@"+match[2]+":"+match[1]+" -- "+lines[i+1].replace(/^\s+/,""))}}return result},opera9:function(e){var ANON="{anonymous}",lineRE=/Line (\d+).*script (?:in )?(\S+)/i;var lines=e.message.split("\n"),result=[];for(var i=2,len=lines.length;i<len;i+=2){var match=lineRE.exec(lines[i]);if(match){result.push(ANON+"()@"+match[2]+":"+match[1]+" -- "+lines[i+1].replace(/^\s+/,""))}}return result},other:function(curr){var ANON="{anonymous}",fnRE=/function\s*([\w\-$]+)?\s*\(/i,stack=[],fn,args,maxStackSize=10;while(curr&&curr["arguments"]&&stack.length<maxStackSize){fn=fnRE.test(curr.toString())?RegExp.$1||ANON:ANON;args=Array.prototype.slice.call(curr["arguments"]||[]);stack[stack.length]=fn+"("+this.stringifyArguments(args)+")";curr=curr.caller}return stack},stringifyArguments:function(args){var result=[];var slice=Array.prototype.slice;for(var i=0;i<args.length;++i){var arg=args[i];if(arg===undefined){result[i]="undefined"}else if(arg===null){result[i]="null"}else if(arg.constructor){if(arg.constructor===Array){if(arg.length<3){result[i]="["+this.stringifyArguments(arg)+"]"}else{result[i]="["+this.stringifyArguments(slice.call(arg,0,1))+"..."+this.stringifyArguments(slice.call(arg,-1))+"]"}}else if(arg.constructor===Object){result[i]="#object"}else if(arg.constructor===Function){result[i]="#function"}else if(arg.constructor===String){result[i]='"'+arg+'"'}else if(arg.constructor===Number){result[i]=arg}}}return result.join(",")},sourceCache:{},ajax:function(url){var req=this.createXMLHTTPObject();if(req){try{req.open("GET",url,false);req.send(null);return req.responseText}catch(e){}}return""},createXMLHTTPObject:function(){var xmlhttp,XMLHttpFactories=[function(){return new XMLHttpRequest},function(){return new ActiveXObject("Msxml2.XMLHTTP")},function(){return new ActiveXObject("Msxml3.XMLHTTP")},function(){return new ActiveXObject("Microsoft.XMLHTTP")}];for(var i=0;i<XMLHttpFactories.length;i++){try{xmlhttp=XMLHttpFactories[i]();this.createXMLHTTPObject=XMLHttpFactories[i];return xmlhttp}catch(e){}}},isSameDomain:function(url){return url.indexOf(location.hostname)!==-1},getSource:function(url){if(!(url in this.sourceCache)){this.sourceCache[url]=this.ajax(url).split("\n")}return this.sourceCache[url]},guessAnonymousFunctions:function(stack){for(var i=0;i<stack.length;++i){var reStack=/\{anonymous\}\(.*\)@(.*)/,reRef=/^(.*?)(?::(\d+))(?::(\d+))?(?: -- .+)?$/,frame=stack[i],ref=reStack.exec(frame);if(ref){var m=reRef.exec(ref[1]);if(m){var file=m[1],lineno=m[2],charno=m[3]||0;if(file&&this.isSameDomain(file)&&lineno){var functionName=this.guessAnonymousFunction(file,lineno,charno);stack[i]=frame.replace("{anonymous}",functionName)}}}}return stack},guessAnonymousFunction:function(url,lineNo,charNo){var ret;try{ret=this.findFunctionName(this.getSource(url),lineNo)}catch(e){ret="getSource failed with url: "+url+", exception: "+e.toString()}return ret},findFunctionName:function(source,lineNo){var reFunctionDeclaration=/function\s+([^(]*?)\s*\(([^)]*)\)/;var reFunctionExpression=/['"]?([0-9A-Za-z_]+)['"]?\s*[:=]\s*function\b/;var reFunctionEvaluation=/['"]?([0-9A-Za-z_]+)['"]?\s*[:=]\s*(?:eval|new Function)\b/;var code="",line,maxLines=Math.min(lineNo,20),m,commentPos;for(var i=0;i<maxLines;++i){line=source[lineNo-i-1];commentPos=line.indexOf("//");if(commentPos>=0){line=line.substr(0,commentPos)}if(line){code=line+code;m=reFunctionExpression.exec(code);if(m&&m[1]){return m[1]}m=reFunctionDeclaration.exec(code);if(m&&m[1]){return m[1]}m=reFunctionEvaluation.exec(code);if(m&&m[1]){return m[1]}}}return"(?)"}};`

Finally, we'll tell the browser to notify us of any errors.

    window.onerror = (message, url, line) ->
      coalmine.error message, url: url, line: line
