#!/usr/bin/env bash
# Copie Leaflet et Leaflet.markercluster (depuis le registre npm) dans public/vendor/.
# Appelé par le workflow avant chaque déploiement ; à lancer aussi en local avant `npm run serve`.
set -euo pipefail
cd "$(dirname "$0")/../public"
rm -rf vendor && mkdir -p vendor && cd vendor
npm pack leaflet@1.9.4 leaflet.markercluster@1.5.3 --silent >/dev/null
tar xzf leaflet-1.9.4.tgz && mv package/dist leaflet && rm -rf package
tar xzf leaflet.markercluster-1.5.3.tgz && mv package/dist markercluster && rm -rf package
rm -f ./*.tgz
ls leaflet/leaflet.js leaflet/leaflet.css markercluster/leaflet.markercluster.js markercluster/MarkerCluster.css
