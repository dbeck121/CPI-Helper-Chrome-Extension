#!/bin/bash

echo "Copy readme to docs..."
cp README.md docs/readme/README.md
# copy paste readme root->docs

echo "Remove old zip file..."
rm -f ./bin/*.zip

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

find . -type f ! \( "${exclude_args[@]}" \) -exec zip -r "bin/${name}_${version}.zip" {} +
