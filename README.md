JavaScript Connector for Coalmine
=================================

Version 0.1.0

This connector allows you to easily send messages to the Coalmine API.

[Coalmine](https://www.getcoalmine.com) is a cloud-based exception and error tracking service for your web apps.

Tested in the following:

* Safari 6 (Mac OS X)
* Chrome (Windows, Mac OS X, Ubuntu)
* Firefox 3 (Windows) and 11 (Windows, Mac OS X)
* Internet Explorer 6-9 (Windows)

Source
------

The only file you need to get started is [coalmine.min.js](https://raw.github.com/coalmine/coalmine_javascript/master/coalmine.min.js) (16 KB).

You can always find the latest source code on [GitHub](https://github.com/coalmine/coalmine_javascript).

Configuration
-------------

Download the latest connector, then add it to your application assets folder.

The minimal JavaScript connector setup is the following:

    <script src="/path/to/coalmine.min.js"></script>
    <script>
    coalmine.configure(function (config) {
      config.signature = "your-signature";
      config.environment = "your-environment"; // e.g., "production"
    });
    </script>

Add this code as early as possible in your page execution.

### Application options

Many additional config options are available but must be populated manually (typically from the server side). We encourage you to use them if possible; these provide much more information when debugging.

| Option              | Type   | Description                              |
| ------------------- | ------ | ---------------------------------------- |
| signature           | string | Application signature.  Required.        |
| environment         | string | Development, test, production, etc.      |
| enabledEnvironments | array  | By default, only staging and production. |
| ipAddress           | string | IP address of visitor                    |
| userId              | string | User ID of the current logged-in user.   |
| version             | string | Application version.                     |

By default, the JavaScript connector will report errors for "production" and "staging" environments.  To report for other environments ("beta", for  example), just add it to the `enabledEnvironments` array:

    <script>
    coalmine.configure(function (config) {
      config.enabledEnvironments.push("beta");
    });
    </script>

Usage
-----

This will automatically catch *most* errors (but not all, due to browser differences) for Internet Explorer 6+, Firefox, Safari, and Chrome.  If you'd like to be sure, wrap code that could fail in a `try`...`catch` statement, like so:

    <script>
    try {
      callDangerousMethod();
    } catch (e) {
      coalmine.notify(e)
    }
    </script>

Setting Custom Variables and User IDs
-------------------------------------

### Custom Variables

You can include extra information by defining custom variables. These are automatically appended to the notification sent to Coalmine and appear in the "Application" tab. Custom variables are added like so:

    <script>
    coalmine.configure(function (config) {
      config.customVariables["ad_id"] = adId;
    });
    </script>

You will most likely initialize your custom application variables at the beginning of the request.

### User IDs

Coalmine has special processing for user IDs.  If you want to set a user ID for this request, use the `userId` configuration option.  A user ID is application-specific; it can be a username, email address, or numeric ID.

    <script>
    coalmine.configure(function (config) {
      config.userId = username;
    });
    </script>

Building
--------

From the root directory, run `./build.sh`.  This will produce four files:

| coalmine.js      | JavaScript compiled from CoffeeScript        |
| coalmine.map     | CoffeeScript => JavaScript source map        |
| coalmine.min.js  | Minified JavaScript                          |
| coalmine.min.map | JavaScript => minified JavaScript source map |
