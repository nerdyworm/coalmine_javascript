#!/bin/bash

coffee --compile --map coalmine.coffee.md
uglifyjs --in-source-map coalmine.map --source-map coalmine.min.map --output coalmine.min.js coalmine.js
