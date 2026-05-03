#!/usr/bin/with-contenv bashio

bashio::log.info "═══════════════════════════════════════════"
bashio::log.info "  HomeDash – Costuri Casă  v4.5"
bashio::log.info "═══════════════════════════════════════════"
bashio::log.info "Pornire server nginx pe portul 8099..."

# Make sure nginx config directory exists
mkdir -p /run/nginx

# Start nginx in foreground
exec nginx -g "daemon off;"
