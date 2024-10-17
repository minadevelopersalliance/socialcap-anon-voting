#!/bin/bash
export FILE=test/$1
export TEST=$2
node --experimental-vm-modules --enable-source-maps node_modules/jest/bin/jest.js $FILE -t $TEST