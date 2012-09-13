JavaScript Connector for Coalmine
=================================

This connector allows you to easily send messages to the Coalmine API.

Tested in Safari 5, Chrome, Firefox 3 and 11, and Internet Explorer 6-9.

Source
------

You can always find the latest source code on [GitHub](https://github.com/coalmine/coalmine_javascript).

Setup and Usage
---------------

Download the latest connector, then add it to your application assets folder.

The minimal JavaScript connector setup is the following:

    <script src="/path/to/coalmine.min.js"></script>
    <script>
    coalmine.configure(function(config) {
      config.signature = "your-signature";
      config.environment = "your-environment"; // e.g., "production"
    });
    </script>

Add this code as early as possible in your page execution.

This will automatically catch *most*\* errors for Internet Explorer 6+, 
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
      config.signature = "your-signature";
      config.environment = "...";
      config.ip_address = "...";
      config.method = "...";
      config.parameters = "...";
      config.version = "...";
    });
    </script>

By default, the JavaScript connector will report errors for "production"
and "staging" environments.  To report for other environments ("beta", for 
example), just add it to the `enabledEnvironments` array:

    <script>
    coalmine.configure(function(config)) {
      // ...other options...
      config.enabledEnvironments.push("beta");
    }
    </script>

\* But not all, due to browser differences.