// Coalmine JavaScript Connector

var coalmine = new function () {
  // Configure in userland like so:
  //
  //   coalmine.configure(function (config) {
  //     config.signature = "my-application-signature";
  //     config.version = "1.0.0";
  //     config.environment = "test";
  //     config.parameters = "foo1=bar1&foo2=bar2"
  //     config.ipAddress = "127.0.0.1"
  //     config.method = "POST"
  //   });
  // 
  // Note the raw parameters string!
  // 
  // It is highly recommended to wrap all code in a try/catch block.  Ideally you
  // would do this in a method that executes when the document is loaded; in
  // jQuery this might look like:
  // 
  //   $(function () {
  //     try {
  //       // Main code here
  //     } catch (e) {
  //       coalmine.notify(e);
  //       // Handle exception
  //     }
  //   });
  //
  var URL_BASE = ":scheme://:host/events?signature=:signature&json=:json";
  var IE_MAX_URL_LENGTH = 2048;
  var TRUNCATED_SEQ = "(...)"
  
  var config = new function () {
    this.scheme = "https";
    this.host = "coalmineapp.com";
    this.enabledEnvironments = ["production", "staging"];
    this.signature = null;
    this.version = null;
    this.environment = null;
    this.parameters = null;
    this.ipAddress = null;
    this.method = null;
    this.customVariables = {};
  };
  var errors = [];
  var that = this;
  
  // Configures instance
  this.configure = function (fn) {
    fn(config);
  };
  
  this.critical = function (message, additionalData) {
    additionalData.severity = "critical";
    this.notify(message, additionalData);
  };
  
  this.crit = this.critical;
  
  this.error = function (message, additionalData) {
    additionalData.severity = "error";
    this.notify(message, additionalData);
  };
  
  this.err = this.error;
  
  this.warning = function (message, additionalData) {
    additionalData.severity = "warning";
    this.notify(message, additionalData);
  };
  
  this.warn = this.warning;
  
  this.info = function (message, additionalData) {
    additionalData.severity = "info";
    this.notify(message, additionalData);
  };
  
  this.debug = function (message, additionalData) {
    additionalData.severity = "debug";
    this.notify(message, additionalData);
  };
  
  this.setCustomVariable = function (key, value) {
    config.customVariables[key] = value;
  };
  
  // Notifies Coalmine of the error
  this.notify = function (message, additionalData) {
    var e = null;
    if (typeof message === "object") {
      e = message;
      message = e.message;
    }
    
    var error = that.createNotification(message, additionalData);
    errors.push(error);
    
    var sendable = false;
    for (var i = 0; i < config.enabledEnvironments.length; i++) {
      if (config.environment == config.enabledEnvironments[i]) {
        sendable = true;
        break;
      }
    }
    
    if (sendable) {
      var src = that.createSafeUrl(error);
      if (! src) { // This should only occur in IE in rare situations
        return; // In any event, abandon the attempt
      }
      var script = document.createElement("script");
      script.src = src;
      var html = document.documentElement;
      if (document.body) {
        document.body.appendChild(script);
      }
    } else {
      return error;
    }
  };
  
  // Creates a URL that's safe to submit in IE (it has a maximum URL limit
  // much lower than other browsers).
  this.createSafeUrl = function (error) {
    var url = that.createUrl(error);
    if (typeof error.user_agent !== "undefined" &&
        error.user_agent.indexOf("MSIE") != -1) {
      var excess = url.length - IE_MAX_URL_LENGTH;
      if (excess <= 0) {
        return url; // URL is already good to go
      }
      
      // URL is too long for IE; one or more of these are probably the culprits.
      // Weigh them by `percentage of excess URL chars * debugging importance`,
      // then sort them according to weight and truncate where possible.
      // For JavaScript, user agent is pretty important, so try to preserve it.
      var parameters = [
        {"name": "user_agent",  "weight": 0},
        {"name": "stack_trace", "weight": 0},
        {"name": "parameters",  "weight": 0},
        {"name": "cookies",     "weight": 0},
        {"name": "referrer",    "weight": 0}
      ];
      var excess = url.length - IE_MAX_URL_LENGTH;
      var totalLength = 0;
      for (var i = 0; i < parameters.length; i++) {
        var parameter = error[parameters[i].name];
        if (typeof parameter === "undefined") {
          continue;
        }
        parameters[i].weight = (parameter.length / excess) * (i + 1);
        totalLength += parameter.length;
      }
      if (totalLength >= excess) {        
        parameters.sort(function(a, b) {
          return b.weight - a.weight;
        });
      
        for (var i = 0; i < parameters.length; i++, url = that.createUrl(error)) {
          excess = url.length - IE_MAX_URL_LENGTH
          if (excess <= 0) {
            break;
          }
          if (parameters[i].weight <= 0) {
            continue;
          }
          var parameter = error[parameters[i].name];
          var newLength = parameter.length - excess - TRUNCATED_SEQ.length;
          if (newLength < 0) {
            newLength = 0;
          }
          // This isn't exact; because of URL encoding, the resulting URL will 
          // always be shorter than IE_MAX_URL_LENGTH.  Better safe than sorry!
          error[parameters[i].name] = parameter.substring(0, newLength) + TRUNCATED_SEQ;
        }
      }
    }
    
    return url; // Even if it's still too long, just send it and hope for the best
  };
  
  // Creates a notification URL
  this.createUrl = function (error) {
    var url = URL_BASE;
    url = url.replace(":scheme", config.scheme);
    url = url.replace(":host", config.host);
    url = url.replace(":signature", config.signature);
    url = url.replace(":json", encodeURIComponent(JSON.stringify(error)));
    return url;
  };
  
  // Returns all logged errors for this request
  this.getErrors = function() {
    return errors;
  };
  
  // Has a certain error message been logged?
  this.hasMessage = function (string) {
    for (var i = 0; i < errors.length; i++) {
      if (errors[i].message.indexOf(string) != -1) {
        return true;
      }
    }
    return false;
  }
  
  // Creates a notification object
  this.createNotification = function (message, additionalData) {
    if (typeof additionalData !== "object") {
      additionalData = {};
    }
    var url = "";
    if ("url" in additionalData) {
      url = additionalData.url;
    }
    var line = "";
    if ("line" in additionalData) {
      line = additionalData.line;
    }
    var severity = "";
    if ("severity" in additionalData) {
      severity = additionalData.severity;
    }
    
    var version = config.version;
    if (version !== null) {
      version = "" + version;
    }
    
    var notification = {
      // Application
      "version": version,
      "app_environment": config.environment,
      "application": config.customVariables,
      
      // Request
      "url": that.getRequestUrl(url),
      "method": config.method, // Need server response for this
      "parameters": config.parameters || that.getParameters(url), // Need server response for POSTs
      "ip_address": config.ipAddress, // Need server response for this
      "hostname": window.location.hostname,
      "user_agent": navigator.userAgent || "",
      "referrer": document.referrer || "",
      "cookies": document.cookie || "",
      
      // Error
      "severity": severity || "ERROR",
      "stack_trace": that.getStackTrace(arguments),
      "message": message || "",
      "line_number": line + "" || ""
    };
    
    for (var key in notification) {
      if (! notification.key) {
        delete notification.key;
      }
    }
    
    return notification;
  };
  
  // Returns the request URL
  this.getRequestUrl = function (url) {
    // Browsers send back some weird values for URL sometimes
    if (typeof url === "string" && url && url !== "undefined") {
      return url;
    } else {
      return window.location.href;
    }
  };
  
  // Returns all GET parameters
  this.getParameters = function (url) {
    var url = that.getRequestUrl(url);
    var parameters = "";
    if (url) {
      // Query string parameters
      if (url.indexOf("?") != -1) {
        parameters = url
          .replace(/.*\?/, "")
          .replace(/#.*/, "")
          .replace(/&$/, "");
      }
      // Google-style anchor parameters
      if (url.indexOf("#") != -1) {
        var anchor = url.replace(/.*#/, "");
        if (/(?:.+=[^\&]*)+/.test(anchor)) {
          anchor = anchor.replace(/&$/, "");
          if (parameters) {
            parameters += "&";
          } else {
          }
          parameters += anchor;
        }
      }
    }
    return parameters;
  };
  
  // Returns a stack trace.  Note that message can be either a string or an
  // exception object.
  this.getStackTrace = function (message, url, line) {
    var stackTrace = "";
    if (typeof message === "object") {
      // message is an exeption object in this case
      stackTrace = printStackTrace({"e": message});
    } else {
      stackTrace = printStackTrace();
    }
    return stackTrace.join("\n");
  };
};

// JSON support for older browsers. Public domain.
// https://github.com/douglascrockford/JSON-js/blob/master/json2.js
var JSON;JSON||(JSON={}),function(){function f(a){return a<10?"0"+a:a}function quote(a){return escapable.lastIndex=0,escapable.test(a)?'"'+a.replace(escapable,function(a){var b=meta[a];return typeof b=="string"?b:"\\u"+("0000"+a.charCodeAt(0).toString(16)).slice(-4)})+'"':'"'+a+'"'}function str(a,b){var c,d,e,f,g=gap,h,i=b[a];i&&typeof i=="object"&&typeof i.toJSON=="function"&&(i=i.toJSON(a)),typeof rep=="function"&&(i=rep.call(b,a,i));switch(typeof i){case"string":return quote(i);case"number":return isFinite(i)?String(i):"null";case"boolean":case"null":return String(i);case"object":if(!i)return"null";gap+=indent,h=[];if(Object.prototype.toString.apply(i)==="[object Array]"){f=i.length;for(c=0;c<f;c+=1)h[c]=str(c,i)||"null";return e=h.length===0?"[]":gap?"[\n"+gap+h.join(",\n"+gap)+"\n"+g+"]":"["+h.join(",")+"]",gap=g,e}if(rep&&typeof rep=="object"){f=rep.length;for(c=0;c<f;c+=1)typeof rep[c]=="string"&&(d=rep[c],e=str(d,i),e&&h.push(quote(d)+(gap?": ":":")+e))}else for(d in i)Object.prototype.hasOwnProperty.call(i,d)&&(e=str(d,i),e&&h.push(quote(d)+(gap?": ":":")+e));return e=h.length===0?"{}":gap?"{\n"+gap+h.join(",\n"+gap)+"\n"+g+"}":"{"+h.join(",")+"}",gap=g,e}}"use strict",typeof Date.prototype.toJSON!="function"&&(Date.prototype.toJSON=function(a){return isFinite(this.valueOf())?this.getUTCFullYear()+"-"+f(this.getUTCMonth()+1)+"-"+f(this.getUTCDate())+"T"+f(this.getUTCHours())+":"+f(this.getUTCMinutes())+":"+f(this.getUTCSeconds())+"Z":null},String.prototype.toJSON=Number.prototype.toJSON=Boolean.prototype.toJSON=function(a){return this.valueOf()});var cx=/[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,escapable=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,gap,indent,meta={"\b":"\\b","\t":"\\t","\n":"\\n","\f":"\\f","\r":"\\r",'"':'\\"',"\\":"\\\\"},rep;typeof JSON.stringify!="function"&&(JSON.stringify=function(a,b,c){var d;gap="",indent="";if(typeof c=="number")for(d=0;d<c;d+=1)indent+=" ";else typeof c=="string"&&(indent=c);rep=b;if(!b||typeof b=="function"||typeof b=="object"&&typeof b.length=="number")return str("",{"":a});throw new Error("JSON.stringify")}),typeof JSON.parse!="function"&&(JSON.parse=function(text,reviver){function walk(a,b){var c,d,e=a[b];if(e&&typeof e=="object")for(c in e)Object.prototype.hasOwnProperty.call(e,c)&&(d=walk(e,c),d!==undefined?e[c]=d:delete e[c]);return reviver.call(a,b,e)}var j;text=String(text),cx.lastIndex=0,cx.test(text)&&(text=text.replace(cx,function(a){return"\\u"+("0000"+a.charCodeAt(0).toString(16)).slice(-4)}));if(/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,"@").replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,"]").replace(/(?:^|:|,)(?:\s*\[)+/g,"")))return j=eval("("+text+")"),typeof reviver=="function"?walk({"":j},""):j;throw new SyntaxError("JSON.parse")})}()

// Universal stack trace method. Public domain.
// https://raw.github.com/eriwen/javascript-stacktrace/master/stacktrace.js
function printStackTrace(a){a=a||{guess:!0};var b=a.e||null,c=!!a.guess,d=new printStackTrace.implementation,e=d.run(b);return c?d.guessAnonymousFunctions(e):e}printStackTrace.implementation=function(){},printStackTrace.implementation.prototype={run:function(a,b){return a=a||this.createException(),b=b||this.mode(a),b==="other"?this.other(arguments.callee):this[b](a)},createException:function(){try{this.undef()}catch(a){return a}},mode:function(a){return a.arguments&&a.stack?"chrome":typeof a.message=="string"&&typeof window!="undefined"&&window.opera?a.stacktrace?a.message.indexOf("\n")>-1&&a.message.split("\n").length>a.stacktrace.split("\n").length?"opera9":a.stack?a.stacktrace.indexOf("called from line")<0?"opera10b":"opera11":"opera10a":"opera9":a.stack?"firefox":"other"},instrumentFunction:function(a,b,c){a=a||window;var d=a[b];a[b]=function(){return c.call(this,printStackTrace().slice(4)),a[b]._instrumented.apply(this,arguments)},a[b]._instrumented=d},deinstrumentFunction:function(a,b){a[b].constructor===Function&&a[b]._instrumented&&a[b]._instrumented.constructor===Function&&(a[b]=a[b]._instrumented)},chrome:function(a){var b=(a.stack+"\n").replace(/^\S[^\(]+?[\n$]/gm,"").replace(/^\s+(at eval )?at\s+/gm,"").replace(/^([^\(]+?)([\n$])/gm,"{anonymous}()@$1$2").replace(/^Object.<anonymous>\s*\(([^\)]+)\)/gm,"{anonymous}()@$1").split("\n");return b.pop(),b},firefox:function(a){return a.stack.replace(/(?:\n@:0)?\s+$/m,"").replace(/^\(/gm,"{anonymous}(").split("\n")},opera11:function(a){var b="{anonymous}",c=/^.*line (\d+), column (\d+)(?: in (.+))? in (\S+):$/,d=a.stacktrace.split("\n"),e=[];for(var f=0,g=d.length;f<g;f+=2){var h=c.exec(d[f]);if(h){var i=h[4]+":"+h[1]+":"+h[2],j=h[3]||"global code";j=j.replace(/<anonymous function: (\S+)>/,"$1").replace(/<anonymous function>/,b),e.push(j+"@"+i+" -- "+d[f+1].replace(/^\s+/,""))}}return e},opera10b:function(a){var b="{anonymous}",c=/^(.*)@(.+):(\d+)$/,d=a.stacktrace.split("\n"),e=[];for(var f=0,g=d.length;f<g;f++){var h=c.exec(d[f]);if(h){var i=h[1]?h[1]+"()":"global code";e.push(i+"@"+h[2]+":"+h[3])}}return e},opera10a:function(a){var b="{anonymous}",c=/Line (\d+).*script (?:in )?(\S+)(?:: In function (\S+))?$/i,d=a.stacktrace.split("\n"),e=[];for(var f=0,g=d.length;f<g;f+=2){var h=c.exec(d[f]);if(h){var i=h[3]||b;e.push(i+"()@"+h[2]+":"+h[1]+" -- "+d[f+1].replace(/^\s+/,""))}}return e},opera9:function(a){var b="{anonymous}",c=/Line (\d+).*script (?:in )?(\S+)/i,d=a.message.split("\n"),e=[];for(var f=2,g=d.length;f<g;f+=2){var h=c.exec(d[f]);h&&e.push(b+"()@"+h[2]+":"+h[1]+" -- "+d[f+1].replace(/^\s+/,""))}return e},other:function(a){var b="{anonymous}",c=/function\s*([\w\-$]+)?\s*\(/i,d=[],e,f,g=10;while(a&&a.arguments&&d.length<g)e=c.test(a.toString())?RegExp.$1||b:b,f=Array.prototype.slice.call(a.arguments||[]),d[d.length]=e+"("+this.stringifyArguments(f)+")",a=a.caller;return d},stringifyArguments:function(a){var b=[],c=Array.prototype.slice;for(var d=0;d<a.length;++d){var e=a[d];e===undefined?b[d]="undefined":e===null?b[d]="null":e.constructor&&(e.constructor===Array?e.length<3?b[d]="["+this.stringifyArguments(e)+"]":b[d]="["+this.stringifyArguments(c.call(e,0,1))+"..."+this.stringifyArguments(c.call(e,-1))+"]":e.constructor===Object?b[d]="#object":e.constructor===Function?b[d]="#function":e.constructor===String?b[d]='"'+e+'"':e.constructor===Number&&(b[d]=e))}return b.join(",")},sourceCache:{},ajax:function(a){var b=this.createXMLHTTPObject();if(b)try{return b.open("GET",a,!1),b.notify(null),b.responseText}catch(c){}return""},createXMLHTTPObject:function(){var a,b=[function(){return new XMLHttpRequest},function(){return new ActiveXObject("Msxml2.XMLHTTP")},function(){return new ActiveXObject("Msxml3.XMLHTTP")},function(){return new ActiveXObject("Microsoft.XMLHTTP")}];for(var c=0;c<b.length;c++)try{return a=b[c](),this.createXMLHTTPObject=b[c],a}catch(d){}},isSameDomain:function(a){return a.indexOf(location.hostname)!==-1},getSource:function(a){return a in this.sourceCache||(this.sourceCache[a]=this.ajax(a).split("\n")),this.sourceCache[a]},guessAnonymousFunctions:function(a){for(var b=0;b<a.length;++b){var c=/\{anonymous\}\(.*\)@(.*)/,d=/^(.*?)(?::(\d+))(?::(\d+))?(?: -- .+)?$/,e=a[b],f=c.exec(e);if(f){var g=d.exec(f[1]);if(g){var h=g[1],i=g[2],j=g[3]||0;if(h&&this.isSameDomain(h)&&i){var k=this.guessAnonymousFunction(h,i,j);a[b]=e.replace("{anonymous}",k)}}}}return a},guessAnonymousFunction:function(a,b,c){var d;try{d=this.findFunctionName(this.getSource(a),b)}catch(e){d="getSource failed with url: "+a+", exception: "+e.toString()}return d},findFunctionName:function(a,b){var c=/function\s+([^(]*?)\s*\(([^)]*)\)/,d=/['"]?([0-9A-Za-z_]+)['"]?\s*[:=]\s*function\b/,e=/['"]?([0-9A-Za-z_]+)['"]?\s*[:=]\s*(?:eval|new Function)\b/,f="",g,h=Math.min(b,20),i,j;for(var k=0;k<h;++k){g=a[b-k-1],j=g.indexOf("//"),j>=0&&(g=g.substr(0,j));if(g){f=g+f,i=d.exec(f);if(i&&i[1])return i[1];i=c.exec(f);if(i&&i[1])return i[1];i=e.exec(f);if(i&&i[1])return i[1]}}return"(?)"}}

// Global error handler
window.onerror = function (message, url, line) {
  coalmine.error(message, {"url": url, "line": line});
};
