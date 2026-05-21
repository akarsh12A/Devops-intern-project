variable "aws_region" {
  type        = string
  description = "AWS region for deployment"
  default     = "us-east-1"
}

variable "instance_type" {
  type        = string
  description = "EC2 instance type (Free Tier eligible)"
  default     = "t2.micro"
}

variable "key_name" {
  type        = string
  description = "Name of the SSH key pair to configure on EC2"
  default     = "devops-key"
}

variable "project_name" {
  type        = string
  description = "Name prefix for resources"
  default     = "devops-dashboard"
}

variable "environment" {
  type        = string
  description = "Deployment environment"
  default     = "production"
}
