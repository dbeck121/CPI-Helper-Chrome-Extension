#!/bin/bash

set -e

#MANIFEST_V3="manifest.json_v3"
#if [ -f "$MANIFEST_V3" ]; then
#    echo "Please make sure we release only manifest v3. Current version is probably not v3."
#    exit 1
#fi

MANIFEST="manifest.json"
MANIFEST_V2="manifest.json_v2"
MANIFEST_V3="manifest.json_v3"

log_message() {
    local message="$1"
    local timestamp
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo "[$timestamp] $message"
}

log_message "Copy readme to docs. Readme.md"
cp README.md docs/readme/README.md

log_message "----------------------"
log_message "Starting zip creation process"

if [ ! -d "./bin" ]; then
    log_message "Creating bin directory..."
    mkdir -p "./bin"
fi

create_zip() {
    local manifest_file="$1"
    local version_name="$2"
    local output_zip="$3"

    log_message "Creating ZIP for $version_name using $manifest_file..."

    name=""
    version=""

    while IFS='' read -r line || [[ -n "$line" ]]; do
        if [[ "$line" == *"\"name\":"* ]]; then
            name=$(echo "$line" | awk -F'"' '{print $4}')
        elif [[ "$line" == *"\"version\":"* ]]; then
            version=$(echo "$line" | awk -F'"' '{print $4}' | tr -d ',')
        fi
    done < "$manifest_file"

    name="${name//,/}"
    name="${name// /_}"

    exclusions=("./docs/*" "./node_modules" "./images/v[1-3]/*" "*.sh" "./bin/*" "*.json_*" "./.*")

    exclude_args=()
    for pattern in "${exclusions[@]}"; do
        exclude_args+=(-o -path "$pattern")
    done
    exclude_args=( "${exclude_args[@]:1}" )

    rm -f "./bin/$output_zip"

    files_to_zip=$(find . -type f ! \( "${exclude_args[@]}" \))
    
    if [ -z "$files_to_zip" ]; then
        log_message "No files found to zip for $version_name. Exiting."
        exit 1
    fi

    echo "$files_to_zip" | zip -@ "bin/$output_zip"

    log_message "ZIP file created: bin/$output_zip"
}

switch_manifest_version() {
    if [ -f "$MANIFEST_V2" ]; then
        log_message "Switching to manifest_v2 (Firefox)..."
        mv "$MANIFEST" "$MANIFEST_V3"
        mv "$MANIFEST_V2" "$MANIFEST"
        create_zip "$MANIFEST" "Firefox" "CPI_Helper_Extension_v2.zip"
        
        mv "$MANIFEST" "$MANIFEST_V2"
        mv "$MANIFEST_V3" "$MANIFEST"
        log_message "Switched back to manifest_v3."
    elif [ -f "$MANIFEST_V3" ]; then
        log_message "Switching to manifest_v3 (Chrome)..."
        mv "$MANIFEST" "$MANIFEST_V2"
        mv "$MANIFEST_V3" "$MANIFEST"
        create_zip "$MANIFEST" "Chrome" "CPI_Helper_Extension_v3.zip"
        
        mv "$MANIFEST" "$MANIFEST_V3"
        mv "$MANIFEST_V2" "$MANIFEST"
        log_message "Switched back to manifest_v2."
    else
        log_message "No alternate manifest files found (manifest.json_v2 or manifest.json_v3)"
        exit 1
    fi
}

manifest_version=$(grep -oP '"manifest_version":\s*\K\d+' "$MANIFEST")

if [ "$manifest_version" == "3" ]; then
    log_message "Manifest version 3 detected (Chrome)"
    create_zip "$MANIFEST" "Chrome" "CPI_Helper_Extension_v3.zip"
elif [ "$manifest_version" == "2" ]; then
    log_message "Manifest version 2 detected (Firefox)"
    create_zip "$MANIFEST" "Firefox" "CPI_Helper_Extension_v2.zip"
else
    log_message "Unknown or unsupported manifest version!"
    exit 1
fi

switch_manifest_version

log_message "Both CPI_Helper_Extension_v3.zip and CPI_Helper_Extension_v2.zip created and moved to bin."
