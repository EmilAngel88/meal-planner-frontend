#!/usr/bin/env bash
# Executed on the application server. Secrets remain in the existing root .env.
set -Eeuo pipefail
umask 077
app_dir=${1:?Application directory is required}
release_dir=${2:?Release directory is required}
edge=${3:-false}
health_url=${4:-}
[[ "$app_dir" =~ ^/[a-zA-Z0-9_./-]+$ && "$release_dir" == "$app_dir"/releases/* ]] || { echo 'Invalid deployment directories' >&2; exit 1; }
[[ "$edge" == true || "$edge" == false ]] || exit 1
[[ -f "$app_dir/.env" && -f "$release_dir/images.env" ]] || { echo 'Server .env or release images.env is missing' >&2; exit 1; }
for command in docker flock curl; do command -v "$command" >/dev/null; done
exec 9>"$app_dir/.deploy.lock"
flock -w 900 9 || { echo 'Another deployment is still running' >&2; exit 1; }
cd "$app_dir"
compose=(docker compose --project-name meal-planner --project-directory "$app_dir" --env-file "$app_dir/.env" --env-file "$release_dir/images.env" -f "$release_dir/docker/compose.images.yml")
if [[ "$edge" == true ]]; then compose+=(-f "$release_dir/docker/compose.edge.yml"); fi
"${compose[@]}" config --quiet
"${compose[@]}" pull backend frontend migrate
"${compose[@]}" up -d --no-deps --wait --wait-timeout 120 postgres

# An application rollback never restores a database over newer user data.
previous_backend=$("${compose[@]}" ps -q backend)
previous_frontend=$("${compose[@]}" ps -q frontend)
rollback_available=false
if [[ -n "$previous_backend" && -n "$previous_frontend" ]]; then
  previous_backend=$(docker inspect --format '{{.Image}}' "$previous_backend")
  previous_frontend=$(docker inspect --format '{{.Image}}' "$previous_frontend")
  printf 'BACKEND_IMAGE=%s\nFRONTEND_IMAGE=%s\n' "$previous_backend" "$previous_frontend" > "$release_dir/rollback.env"
  rollback_available=true
fi
mkdir -p "$app_dir/backups"
backup="$app_dir/backups/pre-$(basename "$release_dir").dump"
"${compose[@]}" exec -T postgres pg_dump -U meal_planner -d meal_planner -Fc > "$backup.partial"
test -s "$backup.partial"
"${compose[@]}" exec -T postgres pg_restore --list < "$backup.partial" > /dev/null
mv "$backup.partial" "$backup"
echo 'Database backup created and validated.'

# Failure here leaves the old application containers running.
"${compose[@]}" run --rm --no-deps migrate
rollback() {
  local status=$?
  trap - ERR
  if [[ "$rollback_available" == true ]]; then
    echo 'Release failed. Restoring the previous application images.' >&2
    BACKEND_IMAGE="$previous_backend" FRONTEND_IMAGE="$previous_frontend" \
      "${compose[@]}" up -d --no-deps --no-build --pull never --wait --wait-timeout 180 backend frontend \
      || echo 'Automatic application rollback failed; inspect the server.' >&2
  else
    echo 'No previous application containers are available for rollback.' >&2
  fi
  exit "$status"
}
trap rollback ERR
"${compose[@]}" up -d --no-deps --no-build --pull never --wait --wait-timeout 180 backend frontend
if [[ -n "$health_url" ]]; then
  curl --fail --silent --show-error --retry 5 --retry-all-errors --retry-delay 3 --max-time 15 "$health_url" > /dev/null
fi
ln -sfn "$release_dir" "$app_dir/current-release.next"
mv -Tf "$app_dir/current-release.next" "$app_dir/current-release"
trap - ERR
echo "Release $(basename "$release_dir") deployed successfully."
