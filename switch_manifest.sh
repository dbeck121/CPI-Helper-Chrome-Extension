#!/bin/bash

# Paths to the Manifest files

MANIFEST="manifest.json"
MANIFEST_V2="manifest_v2.json"
MANIFEST_V3="manifest_v3.json"

if [ -f "$MANIFEST" ]; then
    if [ -f "$MANIFEST_V2" ]; then
        echo "Currently active: manifest.json"
        echo "Switching to manifest_v2.json"
        mv "$MANIFEST" "$MANIFEST_V3" 2>/dev/null || true
        mv "$MANIFEST_V2" "$MANIFEST"
    elif [ -f "$MANIFEST_V3" ]; then
        echo "Currently active: manifest.json"
        echo "Switching to manifest_v3.json"
        mv "$MANIFEST" "$MANIFEST_V2" 2>/dev/null || true
        mv "$MANIFEST_V3" "$MANIFEST"
    else
        echo "No alternate manifest files found (manifest_v2.json or manifest_v3.json)"
    fi
else
    echo "manifest.json file not found!"
fi