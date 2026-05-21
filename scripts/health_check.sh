#!/bin/bash

# Configuration
URL="http://localhost/api/health"
PROJECT_DIR="/home/ubuntu/devops-dashboard"
LOG_FILE="$PROJECT_DIR/logs/backend.log"
TIMEOUT_SEC=5
MAX_RETRY=3

# Ensure log directory and file exist
mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"

# Function to log messages
log_msg() {
  local level="$1"
  local msg="$2"
  echo "$(date -u +'%Y-%m-%d %H:%M:%S UTC') [$level] $msg" >> "$LOG_FILE"
  echo "[$level] $msg"
}

log_msg "INFO" "Self-healing script started: performing health check on $URL..."

# Fetch HTTP status code
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT_SEC "$URL" || echo "000")

if [ "$HTTP_STATUS" -eq 200 ]; then
  log_msg "INFO" "Health check passed. Service returned HTTP 200."
  exit 0
fi

# If status is not 200, attempt recovery
log_msg "WARNING" "Health check FAILED! HTTP Status: $HTTP_STATUS. Initiating self-healing protocol..."

# Navigate to project directory
cd "$PROJECT_DIR" || {
  log_msg "ERROR" "CRITICAL: Could not navigate to directory $PROJECT_DIR"
  exit 1
}

# Restart Docker services
log_msg "WARNING" "Restarting docker containers..."
docker compose restart >> "$LOG_FILE" 2>&1

# Wait for containers to start up
log_msg "INFO" "Waiting 15 seconds for services to re-initialize..."
sleep 15

# Recheck status
RETRY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT_SEC "$URL" || echo "000")

if [ "$RETRY_STATUS" -eq 200 ]; then
  log_msg "SUCCESS" "Self-healing successful. Service recovered and returned HTTP 200."
  exit 0
else
  log_msg "ERROR" "CRITICAL: Self-healing failed. Service remains down after restart (HTTP Status: $RETRY_STATUS)."
  exit 1
fi
