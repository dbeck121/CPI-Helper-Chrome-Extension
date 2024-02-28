#!/bin/bash
cp README.md docs/readme/README.md
# copy paste readme root->docs

rm -f ./bin/CPI-Helper-Extension.zip
zip -r ./bin/CPI-Helper-Extension.zip *
