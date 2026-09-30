#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
: "${DEPLOY_HOST:?Set DEPLOY_HOST}" "${DEPLOY_USER:?Set DEPLOY_USER}"
: "${DEPLOY_SSH_KEY:?Set DEPLOY_SSH_KEY}" "${DEPLOY_KNOWN_HOSTS:?Set DEPLOY_KNOWN_HOSTS}"
: "${GHCR_TOKEN:?Registry token is required}" "${GITHUB_SHA:?}" "${GITHUB_RUN_ID:?}" "${GITHUB_RUN_ATTEMPT:?}" "${GITHUB_ACTOR:?}"
[[ "$DEPLOY_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]+$ && "$DEPLOY_USER" =~ ^[a-zA-Z_][a-zA-Z0-9_-]*$ ]]
[[ "$DEPLOY_PORT" =~ ^[0-9]{1,5}$ && "$DEPLOY_PATH" =~ ^/[a-zA-Z0-9_./-]+$ ]]
[[ "$DEPLOY_EDGE" == true || "$DEPLOY_EDGE" == false ]]
[[ -z "$DEPLOY_HEALTH_URL" || "$DEPLOY_HEALTH_URL" =~ ^https://[a-zA-Z0-9./:_-]+$ ]]
[[ "$GITHUB_SHA" =~ ^[a-f0-9]{40}$ && "$GITHUB_RUN_ID" =~ ^[0-9]+$ && "$GITHUB_RUN_ATTEMPT" =~ ^[0-9]+$ && "$GITHUB_ACTOR" =~ ^[a-zA-Z0-9_-]+$ ]]
test -s release.tgz
auth=$(mktemp -d)
release_id="${GITHUB_SHA}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
remote_auth="/tmp/meal-planner-auth-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
remote_archive="/tmp/meal-planner-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}.tgz"
remote_release="$DEPLOY_PATH/releases/$release_id"
printf '%s\n' "$DEPLOY_SSH_KEY" > "$auth/key"
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$auth/known_hosts"
unset DEPLOY_SSH_KEY DEPLOY_KNOWN_HOSTS
ssh_options=(-i "$auth/key" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$auth/known_hosts" -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=4)
remote="$DEPLOY_USER@$DEPLOY_HOST"
cleanup() {
  ssh "${ssh_options[@]}" -p "$DEPLOY_PORT" "$remote" "rm -rf '$remote_auth'; rm -f '$remote_archive'" </dev/null || true
  rm -rf "$auth"
}
trap cleanup EXIT
scp "${ssh_options[@]}" -P "$DEPLOY_PORT" release.tgz "$remote:$remote_archive"
ssh "${ssh_options[@]}" -p "$DEPLOY_PORT" "$remote" "umask 077; mkdir -p '$remote_release' '$remote_auth'; tar -xzf '$remote_archive' -C '$remote_release'"
printf '%s' "$GHCR_TOKEN" | ssh "${ssh_options[@]}" -p "$DEPLOY_PORT" "$remote" "docker --config '$remote_auth' login ghcr.io -u '$GITHUB_ACTOR' --password-stdin"
unset GHCR_TOKEN
ssh "${ssh_options[@]}" -p "$DEPLOY_PORT" "$remote" "DOCKER_CONFIG='$remote_auth' bash '$remote_release/scripts/deploy-release.sh' '$DEPLOY_PATH' '$remote_release' '$DEPLOY_EDGE' '$DEPLOY_HEALTH_URL'"
