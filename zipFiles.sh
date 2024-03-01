#!/bin/bash

echo "Copy readme to docs..."
cp README.md docs/readme/README.md
# copy paste readme root->docs

echo "Remove old zip file..."
rm -f ./bin/CPI-Helper-Extension.zip

echo "Zipping files..."
zip -r ./bin/CPI-Helper-Extension.zip *
