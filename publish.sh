#!/bin/sh
set -e

IMAGE="wispy6970/cricket-scheduler"
TAG="${1:-latest}"

echo "==> Running tests..."
npm test

echo "==> Building Docker image: ${IMAGE}:${TAG}"
docker build -t "${IMAGE}:${TAG}" .

echo "==> Pushing to Docker Hub..."
docker push "${IMAGE}:${TAG}"

echo "==> Done. Published ${IMAGE}:${TAG}"
