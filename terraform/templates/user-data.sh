#!/bin/bash
set -e

# Redirect output for troubleshooting
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/devport) 2>&1

echo "Starting user-data script execution..."

# Update package repository
apt-get update -y

# Install standard tools
apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release unzip

# Install Docker
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Enable and start Docker daemon
systemctl start docker
systemctl enable docker

# Allow standard user 'ubuntu' to run Docker containers (crucial for CI/CD deploy step)
usermod -aG docker ubuntu

# Setup deployment directories
mkdir -p /home/ubuntu/devops-dashboard/logs
touch /home/ubuntu/devops-dashboard/logs/backend.log
chown -R ubuntu:ubuntu /home/ubuntu/devops-dashboard

# Install AWS CloudWatch Agent
echo "Downloading and installing CloudWatch Agent..."
curl -s -O https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i -E ./amazon-cloudwatch-agent.deb
rm ./amazon-cloudwatch-agent.deb

# Write CloudWatch Configuration file
echo "Configuring CloudWatch Agent..."
cat <<'EOF' > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "cwagent"
  },
  "metrics": {
    "metrics_collected": {
      "cpu": {
        "measurement": [
          "cpu_usage_active",
          "cpu_usage_idle",
          "cpu_usage_system",
          "cpu_usage_user"
        ],
        "metrics_collection_interval": 60,
        "totalcpu": true
      },
      "mem": {
        "measurement": [
          "mem_used_percent",
          "mem_active",
          "mem_total"
        ],
        "metrics_collection_interval": 60
      },
      "disk": {
        "measurement": [
          "disk_used_percent"
        ],
        "metrics_collection_interval": 60,
        "resources": [
          "/"
        ]
      }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/syslog",
            "log_group_name": "DevOps-Dashboard-EC2-Syslog",
            "log_stream_name": "{hostname}-syslog",
            "retention_in_days": 7
          },
          {
            "file_path": "/home/ubuntu/devops-dashboard/logs/backend.log",
            "log_group_name": "DevOps-Dashboard-Backend-Logs",
            "log_stream_name": "{hostname}-backend-logs",
            "retention_in_days": 7
          }
        ]
      }
    }
  }
}
EOF

# Start CloudWatch Agent
echo "Launching CloudWatch Agent..."
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

echo "User Data installation script complete."
