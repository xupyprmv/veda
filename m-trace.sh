#!/bin/sh
rm *.log
rm veda
rm -r .dub
rm dub.selections.json
#dub build --build=debug --config=trace-app
#./veda
ln -s veda veda-fts-worker
ln -s veda veda-js-worker
dub --build=debug --config=trace-app