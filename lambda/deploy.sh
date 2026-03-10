#!/usr/bin/env bash
# Deploy oref-proxy Lambda to il-central-1 (Israel region)
#
# Prerequisites:
#   - AWS CLI installed and configured (`aws configure`)
#   - Your AWS account must have access to the il-central-1 region
#     (Settings → Account → AWS Regions → enable "Israel (Tel Aviv)")
#
# Run: bash deploy.sh
# To update after code changes: bash deploy.sh --update

set -euo pipefail

FUNCTION_NAME="oref-proxy"
REGION="il-central-1"
RUNTIME="nodejs20.x"
HANDLER="oref-proxy.handler"
TIMEOUT=15
ROLE_NAME="oref-proxy-lambda-role"
ZIP_FILE="oref-proxy.zip"

# STS is global — use us-east-1 to avoid issues with opt-in regions
ACCOUNT_ID=$(aws sts get-caller-identity --region us-east-1 --query Account --output text)
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# ── Update path (redeploy code only) ─────────────────────────────────────────
if [[ "${1:-}" == "--update" ]]; then
  echo "→ Packaging..."
  zip -j "$ZIP_FILE" oref-proxy.mjs

  echo "→ Updating function code..."
  aws lambda update-function-code \
    --region "$REGION" \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://${ZIP_FILE}" \
    --query 'FunctionArn' --output text

  echo "✓ Done. Function updated."
  rm -f "$ZIP_FILE"
  exit 0
fi

# ── Full deploy ───────────────────────────────────────────────────────────────

# 1. IAM role
echo "→ Creating IAM role..."
aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }]
  }' \
  --query 'Role.Arn' --output text 2>/dev/null || echo "  (role already exists, continuing)"

aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>/dev/null || true

echo "  Waiting for role to propagate..."
sleep 10

# 2. Package
echo "→ Packaging..."
zip -j "$ZIP_FILE" oref-proxy.mjs

# 3. Create function
echo "→ Creating Lambda function in ${REGION}..."
aws lambda create-function \
  --region "$REGION" \
  --function-name "$FUNCTION_NAME" \
  --runtime "$RUNTIME" \
  --role "$ROLE_ARN" \
  --handler "$HANDLER" \
  --zip-file "fileb://${ZIP_FILE}" \
  --timeout "$TIMEOUT" \
  --query 'FunctionArn' --output text

# 4. Function URL (public HTTPS endpoint — no API Gateway needed)
echo "→ Creating Function URL..."
FUNCTION_URL=$(aws lambda create-function-url-config \
  --region "$REGION" \
  --function-name "$FUNCTION_NAME" \
  --auth-type NONE \
  --cors '{"AllowOrigins":["*"],"AllowMethods":["GET"],"AllowHeaders":["content-type"],"MaxAge":86400}' \
  --query 'FunctionUrl' --output text)

# 5. Allow public invocation
echo "→ Granting public access..."
aws lambda add-permission \
  --region "$REGION" \
  --function-name "$FUNCTION_NAME" \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --query 'Statement' --output text > /dev/null

rm -f "$ZIP_FILE"

echo ""
echo "✓ Deployed successfully!"
echo ""
echo "  Function URL: ${FUNCTION_URL}"
echo ""
echo "  Next step — set this in Vercel:"
echo "  NEXT_PUBLIC_OREF_PROXY=${FUNCTION_URL%/}"
echo ""
echo "  Test it:"
echo "  curl \"${FUNCTION_URL}history?mode=1&lang=he\" | head -c 200"
