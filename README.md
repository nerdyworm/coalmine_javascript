Coalmine HTML5 JavaScript Connector
===================================

Tested in Safari 5, Chrome, Firefox 3 and 11, and Internet Explorer 6-9.

The minimal HTML5 JavaScript connector setup is the following:

    <script src="/path/to/coalmine.min.js"></script>
    <script>
    coalmine.configure(function(config) {
      config.signature = "your-app-signature-here";
      config.environment = "your-environment"; // e.g., "production"
    });
    </script>

This will automatically catch *most*\* errors for Internet Explorer 5.5+, 
Firefox, Safari, and Chrome.  If you'd like to be sure, wrap code that could 
fail in a `try`...`catch` statement, like so:

    <script>
    try {
      // Code that could fail
    } catch (e) {
      coalmine.notify(e)
    }
    </script>

Many additional config options are available but must be populated manually
(typically from the server side). We encourage you to use them if possible;
these provide much more information when debugging.

    <script src="/path/to/coalmine.min.js"></script>
    <script>
    coalmine.configure(function(config) {
      config.signature = "your-app-signature-here";
      config.environment = "...";
      config.ip_address = "...";
      config.method = "...";
      config.parameters = "...";
      config.version = "...";
    });
    </script>

By default, the HTML5 JavaScript connector will report errors for "production"
and "staging" environments.  To report for other environments ("beta", for 
example), just add it to the `enabledEnvironments` array:

    <script>
    coalmine.configure(function(config)) {
      // ...other options...
      config.enabledEnvironments.push("beta");
    }
    </script>

\* But not all, due to browser differences.