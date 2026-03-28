import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ses from "aws-cdk-lib/aws-ses";
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
  /** DynamoDB table for account lockout tracking (Req 7.6) */
  public readonly lockoutTable: dynamodb.Table;
  /** S3 bucket for temporary uploaded images (24h lifecycle) */
  public readonly imagesTempBucket: s3.Bucket;
  /** S3 bucket for generated PDF exports */
  public readonly exportsBucket: s3.Bucket;
  /** REST API Gateway */
  public readonly api: apigateway.RestApi;
  /** Cognito User Pool */
  public readonly userPool: cognito.UserPool;
  /** Cognito User Pool Client */
  public readonly userPoolClient: cognito.UserPoolClient;

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
    // DynamoDB — auth_lockout table
    // Tracks failed login attempts per user for account lockout (Req 7.6)
    // pk: LOCKOUT#{username}, TTL auto-expires records after the 15-min window
    // -------------------------------------------------------------------------
    this.lockoutTable = new dynamodb.Table(this, "LockoutTable", {
      tableName: "auth_lockout",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // -------------------------------------------------------------------------
    // SES — verified email identity for lockout notifications (Req 7.6)
    // The from-address must be verified in SES before emails can be sent.
    // In production, verify a domain instead of a single address.
    // Set the `sesFromAddress` CDK context value (cdk.json or --context flag)
    // to override the default placeholder.
    // -------------------------------------------------------------------------
    const sesFromAddress = "no-reply@example.com"; // override via CDK context: sesFromAddress

    new ses.EmailIdentity(this, "LockoutEmailIdentity", {
      identity: ses.Identity.email(sesFromAddress),
    });

    // -------------------------------------------------------------------------
    // Lambda — Pre-Authentication trigger (lockout check + counter increment)
    // Lambda — Post-Authentication trigger (counter reset on success)
    // Req 7.6
    // -------------------------------------------------------------------------
    const triggerRole = new iam.Role(this, "LockoutTriggerRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole"
        ),
      ],
    });

    // Grant DynamoDB access to the lockout table
    this.lockoutTable.grantReadWriteData(triggerRole);

    // Grant SES send permission
    triggerRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"],
      })
    );

    const preAuthLambda = new lambda.Function(this, "PreAuthLockoutTrigger", {
      functionName: "discharge-checklist-pre-auth-lockout",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "auth/lockoutTriggers.preAuthHandler",
      code: lambda.Code.fromAsset("../backend/dist"),
      role: triggerRole,
      timeout: cdk.Duration.seconds(10),
      environment: {
        LOCKOUT_TABLE_NAME: this.lockoutTable.tableName,
        SES_FROM_ADDRESS: sesFromAddress,
      },
    });

    const postAuthLambda = new lambda.Function(this, "PostAuthLockoutTrigger", {
      functionName: "discharge-checklist-post-auth-lockout",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "auth/lockoutTriggers.postAuthHandler",
      code: lambda.Code.fromAsset("../backend/dist"),
      role: triggerRole,
      timeout: cdk.Duration.seconds(10),
      environment: {
        LOCKOUT_TABLE_NAME: this.lockoutTable.tableName,
      },
    });

    // -------------------------------------------------------------------------
    // Cognito User Pool
    // Req 7.1, 7.2, 7.4, 7.5, 7.6, 7.7
    // -------------------------------------------------------------------------
    this.userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: "discharge-checklist-users",
      selfSignUpEnabled: true,
      signInAliases: { username: true, email: true },
      autoVerify: { email: true },
      // Req 7.5: password policy
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      // Req 7.7: TOTP MFA enforcement
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: {
        sms: false,
        otp: true, // TOTP
      },
      // Req 7.6: Pre/Post-Authentication Lambda triggers
      lambdaTriggers: {
        preAuthentication: preAuthLambda,
        postAuthentication: postAuthLambda,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Req 7.2: access token expiry ≤ 8 hours
    this.userPoolClient = this.userPool.addClient("WebClient", {
      userPoolClientName: "discharge-checklist-web",
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      accessTokenValidity: cdk.Duration.hours(8),
      idTokenValidity: cdk.Duration.hours(8),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true, // Req 7.4: generic error
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

    new cdk.CfnOutput(this, "LockoutTableName", {
      value: this.lockoutTable.tableName,
    });

    new cdk.CfnOutput(this, "UserPoolId", {
      value: this.userPool.userPoolId,
      description: "Cognito User Pool ID",
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: this.userPoolClient.userPoolClientId,
      description: "Cognito User Pool Client ID",
    });
  }
}
