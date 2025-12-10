#!/bin/bash

docker compose exec frontend npm run build

cd frontend && npm run deploy