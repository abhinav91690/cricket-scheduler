#!/bin/sh
set -e

IMAGE="wispy6970/cricket-scheduler"
TAG="${1:-latest}"
PLATFORM="${2:-}"

echo "==> Running tests..."
npm test

if [ -n "$PLATFORM" ]; then
  echo "==> Building for platform: ${PLATFORM}"
  docker buildx build --platform "$PLATFORM" -t "${IMAGE}:${TAG}" --push .
else
  echo "==> Building Docker image (native platform): ${IMAGE}:${TAG}"
  docker build -t "${IMAGE}:${TAG}" .
  echo "==> Pushing to Docker Hub..."
  docker push "${IMAGE}:${TAG}"
fi

echo "==> Done. Published ${IMAGE}:${TAG}"
