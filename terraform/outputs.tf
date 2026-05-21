output "instance_id" {
  description = "The ID of the EC2 instance"
  value       = aws_instance.web.id
}

output "instance_public_ip" {
  description = "The public IP of the EC2 instance"
  value       = aws_instance.web.public_ip
}

output "instance_public_dns" {
  description = "The public DNS of the EC2 instance"
  value       = aws_instance.web.public_dns
}

output "dashboard_url" {
  description = "The URL to access the DevOps Monitoring Dashboard"
  value       = "http://${aws_instance.web.public_ip}"
}

output "ssh_connection_string" {
  description = "SSH connection string to access the EC2 instance"
  value       = "ssh -i ~/.ssh/${var.key_name}.pem ubuntu@${aws_instance.web.public_ip}"
}
