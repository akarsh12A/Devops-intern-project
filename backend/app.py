import os
import time
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS
import psutil
import docker

# Configure logging
LOG_FILE = os.environ.get("BACKEND_LOG_PATH", "backend.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
# Enable CORS for development
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Record start time for system uptime
START_TIME = time.time()

def get_sys_uptime():
    try:
        return time.time() - psutil.boot_time()
    except Exception:
        return time.time() - START_TIME

@app.route('/api/health', methods=['GET'])
def health():
    logger.info("Health check endpoint queried")
    return jsonify({
        "status": "healthy",
        "service": "DevOps Monitoring Backend",
        "timestamp": time.time(),
        "uptime": round(time.time() - START_TIME, 2)
    })

@app.route('/api/metrics', methods=['GET'])
def metrics():
    logger.info("Metrics endpoint queried")
    try:
        # CPU Info
        cpu_percent = psutil.cpu_percent(interval=None)
        cpu_cores_percent = psutil.cpu_percent(interval=None, percpu=True)
        cpu_count = psutil.cpu_count()

        # Memory Info
        virtual_mem = psutil.virtual_memory()
        memory_data = {
            "total_gb": round(virtual_mem.total / (1024 ** 3), 2),
            "available_gb": round(virtual_mem.available / (1024 ** 3), 2),
            "used_gb": round(virtual_mem.used / (1024 ** 3), 2),
            "free_gb": round(virtual_mem.free / (1024 ** 3), 2),
            "percent": virtual_mem.percent
        }

        # Disk Info (root partition)
        disk_usage = psutil.disk_usage('/')
        disk_data = {
            "total_gb": round(disk_usage.total / (1024 ** 3), 2),
            "used_gb": round(disk_usage.used / (1024 ** 3), 2),
            "free_gb": round(disk_usage.free / (1024 ** 3), 2),
            "percent": disk_usage.percent
        }

        # Load average (Unix only, fall back for Windows)
        try:
            load_avg = os.getloadavg()
        except AttributeError:
            load_avg = [0.0, 0.0, 0.0]

        return jsonify({
            "status": "success",
            "uptime_seconds": round(get_sys_uptime(), 0),
            "cpu": {
                "percent": cpu_percent,
                "cores_percent": cpu_cores_percent,
                "count": cpu_count
            },
            "memory": memory_data,
            "disk": disk_data,
            "load_average": load_avg
        })
    except Exception as e:
        logger.error(f"Error gathering metrics: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/containers', methods=['GET'])
def containers():
    logger.info("Containers status endpoint queried")
    try:
        # Try to connect to docker daemon on host via mounted docker socket
        client = docker.from_env()
        container_list = client.containers.list(all=True)
        
        containers_data = []
        for c in container_list:
            # Shorten ID to standard 12 characters
            cid = c.id[:12]
            
            # Simple state parser
            state = c.attrs.get('State', {})
            status = c.status  # running, exited, etc.
            
            # Build container status payload
            containers_data.append({
                "id": cid,
                "name": c.name,
                "status": status,
                "image": c.image.tags[0] if c.image.tags else c.image.id[:19],
                "created": c.attrs.get('Created', '')[:19].replace('T', ' '),
                "ports": list(c.ports.keys()) if c.ports else [],
                "state": {
                    "running": state.get("Running", False),
                    "started_at": state.get("StartedAt", "")[:19].replace('T', ' '),
                    "error": state.get("Error", "")
                }
            })
            
        return jsonify({
            "status": "success",
            "docker_daemon": "connected",
            "count": len(containers_data),
            "containers": containers_data
        })
    except Exception as e:
        logger.warning(f"Docker daemon query failed: {str(e)}")
        return jsonify({
            "status": "warning",
            "docker_daemon": "disconnected",
            "message": "Could not connect to Docker Daemon. Ensure /var/run/docker.sock is mounted.",
            "containers": []
        })

@app.route('/api/deployment', methods=['GET'])
def deployment_info():
    logger.info("Deployment info endpoint queried")
    # Path to deployment metadata written by CI/CD
    deploy_file = "deployment.json"
    if os.path.exists(deploy_file):
        try:
            import json
            with open(deploy_file, 'r') as f:
                data = json.load(f)
            return jsonify(data)
        except Exception as e:
            logger.error(f"Error reading deployment file: {str(e)}")
            
    # Default fallback data if file doesn't exist
    return jsonify({
        "status": "active",
        "environment": "production",
        "last_deployment": "Initial Launch (Manual)",
        "commit_hash": "N/A",
        "commit_message": "Initial deploy setup",
        "branch": "main",
        "author": "DevOps Administrator"
    })

@app.route('/api/logs', methods=['GET'])
def get_logs():
    logger.info("Logs endpoint queried")
    # Limit number of lines to avoid excessive memory usage
    limit = request.args.get('limit', default=50, type=int)
    if limit > 200:
        limit = 200
        
    log_lines = []
    if os.path.exists(LOG_FILE):
        try:
            with open(LOG_FILE, 'r') as f:
                # Read all lines and grab the last 'limit' lines
                lines = f.readlines()
                log_lines = [line.strip() for line in lines[-limit:]]
        except Exception as e:
            log_lines = [f"Error reading log file: {str(e)}"]
    else:
        log_lines = ["No log entries found. Start application to trigger logs."]
        
    return jsonify({
        "status": "success",
        "file": LOG_FILE,
        "count": len(log_lines),
        "logs": log_lines
    })

if __name__ == '__main__':
    # When running locally via flask, listen on all interfaces
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
