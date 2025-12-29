#!/bin/bash

GIT_COMMIT=$(git describe --tags --always --dirty)
echo "Building Docker image with GIT_COMMIT=$GIT_COMMIT"
DOCKER_BUILDKIT=1 docker build --build-arg GIT_COMMIT="$GIT_COMMIT" -t bookscout .
