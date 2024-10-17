#!/bin/bash
pnpm build > /dev/null
node build/test/inspect-kvstorage.js $1
