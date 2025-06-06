#!/bin/bash

set -e

MANIFEST="manifest.json"

BIN_DIR="./bin"

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

if [ ! -d "$BIN_DIR" ]; then
    log_message "Creating bin directory..."
    mkdir -p "$BIN_DIR"
fi


if [ -d "$BIN_DIR" ]; then
  # delete all files and subdirectories in the directory
  log_message "deleting zip files from bin directory..."
  rm -rf "$BIN_DIR"/*
fi

create_zip() {
    local manifest_file="$1"
    local output_zip="$2"

    log_message "Creating ZIP using $manifest_file..."

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

    exclusions=("./docs/*" ".DS_Store" "*.json_*" "./node_modules" "./images/v[1-3]/*" "*.sh" "./bin" "./bin/*" "*.json_*" "./.*")

    exclude_args=()
    for pattern in "${exclusions[@]}"; do
        exclude_args+=(-o -path "$pattern")
    done
    exclude_args=( "${exclude_args[@]:1}" )

    files_to_zip=$(find . -type f ! \( "${exclude_args[@]}" \))
    
    if [ -z "$files_to_zip" ]; then
        log_message "No files found to zip for $version_name. Exiting."
        exit 1
    fi

    echo "$files_to_zip" | zip -@ "$BIN_DIR/$output_zip"

    log_message "ZIP file created: $BIN_DIR/$output_zip"
}

manifest_version=$(jq -r '.manifest_version' manifest.json)
# version=$(jq -r '.version' manifest.json)
echo "Manifest version is: $manifest_version"

create_zip "$MANIFEST" "CPI_Helper_Extension_manifestv${manifest_version}.zip"

log_message "Both CPI_Helper_Extension_v3.zip and moved to bin."
