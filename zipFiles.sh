#!/bin/bash


echo "Remove old zip file..."
rm -f ./bin/*.zip

./createBin.sh

./switch_manifest.sh
sleep 2

./createBin.sh

./switch_manifest.sh
sleep 1
