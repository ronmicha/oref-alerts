#!/usr/bin/env bash
# Deploy oref-proxy Lambda + API Gateway to il-central-1 (Israel region)
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
API_NAME="oref-proxy"

# STS is global — use us-east-1 to avoid issues with opt-in regions
ACCOUNT_ID=$(aws sts get-caller-identity --region us-east-1 --query Account --output text)
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
FUNCTION_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}"

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

# 3. Create Lambda function (skip if already exists)
echo "→ Creating Lambda function in ${REGION}..."
aws lambda create-function \
  --region "$REGION" \
  --function-name "$FUNCTION_NAME" \
  --runtime "$RUNTIME" \
  --role "$ROLE_ARN" \
  --handler "$HANDLER" \
  --zip-file "fileb://${ZIP_FILE}" \
  --timeout "$TIMEOUT" \
  --query 'FunctionArn' --output text 2>/dev/null || echo "  (function already exists, continuing)"

rm -f "$ZIP_FILE"

# 4. API Gateway HTTP API
echo "→ Creating API Gateway HTTP API..."
API_ID=$(aws apigatewayv2 create-api \
  --region "$REGION" \
  --name "$API_NAME" \
  --protocol-type HTTP \
  --cors-configuration 'AllowOrigins=["*"],AllowMethods=["GET"],AllowHeaders=["content-type"],MaxAge=86400' \
  --query 'ApiId' --output text)

# 5. Lambda integration
echo "→ Creating Lambda integration..."
INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --region "$REGION" \
  --api-id "$API_ID" \
  --integration-type AWS_PROXY \
  --integration-uri "$FUNCTION_ARN" \
  --payload-format-version 2.0 \
  --query 'IntegrationId' --output text)

# 6. Default route (catches /history, /cities, /categories)
echo "→ Creating default route..."
aws apigatewayv2 create-route \
  --region "$REGION" \
  --api-id "$API_ID" \
  --route-key '$default' \
  --target "integrations/${INTEGRATION_ID}" \
  --query 'RouteId' --output text > /dev/null

# 7. Auto-deploy stage
echo "→ Creating stage..."
aws apigatewayv2 create-stage \
  --region "$REGION" \
  --api-id "$API_ID" \
  --stage-name '$default' \
  --auto-deploy \
  --query 'StageName' --output text > /dev/null

# 8. Allow API Gateway to invoke the Lambda
echo "→ Granting API Gateway permission to invoke Lambda..."
aws lambda add-permission \
  --region "$REGION" \
  --function-name "$FUNCTION_NAME" \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*" \
  --query 'Statement' --output text > /dev/null

API_URL="https://${API_ID}.execute-api.${REGION}.amazonaws.com"

echo ""
echo "✓ Deployed successfully!"
echo ""
echo "  API URL: ${API_URL}"
echo ""
echo "  Next step — set this in Vercel:"
echo "  NEXT_PUBLIC_OREF_PROXY=${API_URL}"
echo ""
echo "  Test it:"
echo "  curl \"${API_URL}/history?mode=1&lang=he\" | head -c 200"
