output "cloudfront_url" {
  description = "Access this URL to see your Frontend"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "s3_bucket_name" {
  description = "Upload your React build files here"
  value       = aws_s3_bucket.frontend.id
}