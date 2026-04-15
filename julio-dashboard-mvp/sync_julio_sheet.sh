#!/bin/zsh
set -euo pipefail

cd "$(dirname "$0")"

export ACCOUNTS_CSV_URL='https://docs.google.com/spreadsheets/d/19geWVUxQvBnvwwgycW3aF3n68YV8usljQrQx63kLUAg/export?format=csv&gid=0'
export SETTLEMENTS_CSV_URL='https://docs.google.com/spreadsheets/d/19geWVUxQvBnvwwgycW3aF3n68YV8usljQrQx63kLUAg/export?format=csv&gid=948697058'
export OPERATIONS_CSV_URL='https://docs.google.com/spreadsheets/d/19geWVUxQvBnvwwgycW3aF3n68YV8usljQrQx63kLUAg/export?format=csv&gid=2059476643'

node sync_from_google_sheets.js
node merge_sphere_into_current.js
