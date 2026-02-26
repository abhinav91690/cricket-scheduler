#!/bin/sh
set -e

IMAGE="wispy6970/cricket-scheduler"
TAG="${1:-latest}"

echo "==> Running tests..."
npm test

echo "==> Building Docker image for linux/amd64: ${IMAGE}:${TAG}"
docker buildx build --platform linux/amd64 -t "${IMAGE}:${TAG}" --push .

echo "==> Done. Published ${IMAGE}:${TAG}"
