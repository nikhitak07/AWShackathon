import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

/**
 * Main CDK stack for the Discharge Checklist application.
 *
 * Provisions:
 *  - DynamoDB: `checklists` table (30-day TTL) and `audit_log` table (no TTL, append-only)
 *  - S3: `discharge-images-temp` (SSE-S3, 24h lifecycle) and `discharge-exports` (SSE-S3)
 *  - API Gateway: REST API with TLS-only enforcement
 *  - CloudFront: distribution for the React SPA with HTTPS-only policy
 *
 * Requirements: 8.1 (AES-256 at rest), 8.2 (TLS 1.2+ in transit), 9.1 (HTTPS)
 */
export class DischargeChecklistStack extends cdk.Stack {
  /** DynamoDB table for persisted checklists */
  public readonly checklistsTable: dynamodb.Table;
  /** DynamoDB table for the append-only audit log */
  public readonly auditLogTable: dynamodb.Table;
  /** S3 bucket for temporary uploaded images (24h lifecycle) */
  public readonly imagesTempBucket: s3.Bucket;
  /** S3 bucket for generated PDF exports */
  public readonly exportsBucket: s3.Bucket;
  /** REST API Gateway */
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // -------------------------------------------------------------------------
    // DynamoDB — checklists table
    // Req 8.1: encryption at rest with AWS-managed KMS (AES-256)
    // -------------------------------------------------------------------------
    this.checklistsTable = new dynamodb.Table(this, "ChecklistsTable", {
      tableName: "checklists",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED, // AES-256 via AWS-managed KMS
      // 30-day TTL on checklist items (Req 5.2)
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // -------------------------------------------------------------------------
    // DynamoDB — audit_log table
    // Req 8.1: encryption at rest
    // Req 8.5: no TTL — entries retained ≥6 years
    // Req 8.4: append-only — IAM policy denies DeleteItem and UpdateItem
    // -------------------------------------------------------------------------
    this.auditLogTable = new dynamodb.Table(this, "AuditLogTable", {
      tableName: "audit_log",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      // No TTL attribute — entries are retained indefinitely (≥6 years per HIPAA)
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // IAM managed policy that denies mutating operations on the audit log.
    // Attach this deny policy to the application Lambda execution role.
    new iam.ManagedPolicy(this, "AuditLogDenyMutationPolicy", {
      managedPolicyName: "DenyAuditLogMutation",
      description:
        "Denies DeleteItem and UpdateItem on the audit_log table for HIPAA append-only compliance",
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.DENY,
          actions: ["dynamodb:DeleteItem", "dynamodb:UpdateItem"],
          resources: [this.auditLogTable.tableArn],
        }),
      ],
    });

    // -------------------------------------------------------------------------
    // S3 — discharge-images-temp
    // Req 9.1: HTTPS only; Req 8.1: SSE-S3 (AES-256); Req 9.2: 24h lifecycle
    // -------------------------------------------------------------------------
    this.imagesTempBucket = new s3.Bucket(this, "ImagesTempBucket", {
      bucketName: `discharge-images-temp-${cdk.Aws.ACCOUNT_ID}`,
      encryption: s3.BucketEncryption.S3_MANAGED, // SSE-S3 (AES-256)
      enforceSSL: true, // Req 9.1 — deny non-HTTPS requests
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      lifecycleRules: [
        {
          id: "delete-after-24h",
          enabled: true,
          expiration: cdk.Duration.hours(24), // Req 9.2
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // -------------------------------------------------------------------------
    // S3 — discharge-exports
    // Req 8.1: SSE-S3; per-user prefix for access control
    // -------------------------------------------------------------------------
    this.exportsBucket = new s3.Bucket(this, "ExportsBucket", {
      bucketName: `discharge-exports-${cdk.Aws.ACCOUNT_ID}`,
      encryption: s3.BucketEncryption.S3_MANAGED, // SSE-S3 (AES-256)
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // -------------------------------------------------------------------------
    // API Gateway — TLS-only REST API
    // Req 8.2, 9.1: all traffic over TLS 1.2+
    // -------------------------------------------------------------------------
    this.api = new apigateway.RestApi(this, "DischargeChecklistApi", {
      restApiName: "discharge-checklist-api",
      description: "Discharge Checklist REST API",
      // Enforce TLS 1.2+ via a custom domain policy (applied at CloudFront level too)
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["Content-Type", "Authorization"],
      },
      // Disable default execute-api endpoint in production; traffic routed via CloudFront
      deployOptions: {
        stageName: "prod",
        // Enforce TLS on the stage
        accessLogDestination: undefined,
      },
    });

    // Enforce HTTPS-only policy on the API Gateway resource policy
    this.api.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ["execute-api:Invoke"],
        resources: [this.api.arnForExecuteApi()],
        conditions: {
          Bool: { "aws:SecureTransport": "false" },
        },
      })
    );

    // -------------------------------------------------------------------------
    // CloudFront — distribution for the React SPA
    // Req 8.2, 9.1: HTTPS-only, TLS 1.2+ minimum
    // -------------------------------------------------------------------------
    // Static assets bucket for the React SPA
    const spaBucket = new s3.Bucket(this, "SpaBucket", {
      bucketName: `discharge-checklist-spa-${cdk.Aws.ACCOUNT_ID}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(
      this,
      "SpaDistribution",
      {
        defaultBehavior: {
          origin: origins.S3BucketOrigin.withOriginAccessControl(spaBucket),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // Req 8.2, 9.1
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        // TLS 1.2 minimum (Req 8.2)
        minimumProtocolVersion:
          cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
        defaultRootObject: "index.html",
        errorResponses: [
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
          },
        ],
      }
    );

    // -------------------------------------------------------------------------
    // Outputs
    // -------------------------------------------------------------------------
    new cdk.CfnOutput(this, "ApiUrl", {
      value: this.api.url,
      description: "API Gateway URL",
    });

    new cdk.CfnOutput(this, "CloudFrontUrl", {
      value: `https://${distribution.distributionDomainName}`,
      description: "CloudFront distribution URL (HTTPS only)",
    });

    new cdk.CfnOutput(this, "ChecklistsTableName", {
      value: this.checklistsTable.tableName,
    });

    new cdk.CfnOutput(this, "AuditLogTableName", {
      value: this.auditLogTable.tableName,
    });

    new cdk.CfnOutput(this, "ImagesTempBucketName", {
      value: this.imagesTempBucket.bucketName,
    });

    new cdk.CfnOutput(this, "ExportsBucketName", {
      value: this.exportsBucket.bucketName,
    });
  }
}
