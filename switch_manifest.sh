#!/bin/bash

# Paths to the Manifest files

MANIFEST="manifest.json"
MANIFEST_V2="manifest.json_v2"
MANIFEST_V3="manifest.json_v3"

if [ -f "$MANIFEST" ]; then
    if [ -f "$MANIFEST_V2" ]; then
        echo "Currently active: manifest.json"
        echo "Switching to manifest.json_v2"
        mv "$MANIFEST" "$MANIFEST_V3" 2>/dev/null || true
        mv "$MANIFEST_V2" "$MANIFEST"
    elif [ -f "$MANIFEST_V3" ]; then
        echo "Currently active: manifest.json"
        echo "Switching to manifest.json_v3"
        mv "$MANIFEST" "$MANIFEST_V2" 2>/dev/null || true
        mv "$MANIFEST_V3" "$MANIFEST"
    else
        echo "No alternate manifest files found (manifest.json_v2 or manifest.json_v3)"
    fi
else
    echo "manifest.json file not found!"
fi