#!/bin/bash

#MANIFEST_V3="manifest.json_v3"
#if [ -f "$MANIFEST_V3" ]; then
#    echo "Please make sure we release only manifest v3. Current version is probably not v3."
#    exit 1
#fi

echo "Copy readme to docs..."
cp README.md docs/readme/README.md
# copy paste readme root->docs

# Path to the manifest.json file
manifest_file="manifest.json"

# Check if jq is installed
if ! command -v jq &> /dev/null
then
    echo "The jq command could not be found. Please install jq to use this script."
    exit 1
fi

# Extract the manifest_version from the manifest.json
manifest_version=$(jq -r '.manifest_version' "${manifest_file}")

# Check if the variable is not empty
if [ -z "$manifest_version" ]; then
    echo "manifest_version could not be extracted from the manifest.json file."
else
    echo "The manifest_version is: $manifest_version"
fi

# create a dynamic name + zip files as per manifest.json name and version field
name=""
version=""
while IFS='' read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == *"\"name\":"* ]]; then
        name=$(echo "$line" | awk -F'"' '{print $4}')
    elif [[ "$line" == *"\"version\":"* ]]; then
        version=$(echo "$line" | awk -F'"' '{print $4}' | tr -d ',')
    fi
done < manifest.json

# replace comma , space with underscore.
name="${name//,/}"
name="${name// /_}"

exclusions=("./docs/*" "./node_modules" "./images/v[1-3]/*" "./.*")

exclude_args=()
for pattern in "${exclusions[@]}"; do
    exclude_args+=( -o -path "$pattern" )
done
exclude_args=( "${exclude_args[@]:1}" )

find . -type f ! \( "${exclude_args[@]}" \) -exec zip -r "bin/${name}_manifestv${manifest_version}_${version}.zip" {} +
