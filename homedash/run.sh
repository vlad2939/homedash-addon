#!/bin/sh
echo ">> Pornire server Home Cost App..."

# Ne asigurăm că directorul persistat /data există
mkdir -p /data

export PORT=3000
export DATA_DIR=/data

# Pornim serverul de producție Node.js construit din angular app
node dist/app/server/server.mjs
