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

export class DischargeChecklistStack extends cdk.Stack {
  public readonly checklistsTable: dynamodb.Table;
  public readonly auditLogTable: dynamodb.Table;
  public readonly lockoutTable: dynamodb.Table;
  public readonly imagesTempBucket: s3.Bucket;
  public readonly exportsBucket: s3.Bucket;
  public readonly api: apigateway.RestApi;
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // -------------------------------------------------------------------------
    // DynamoDB tables
    // -------------------------------------------------------------------------
    this.checklistsTable = new dynamodb.Table(this, "ChecklistsTable", {
      tableName: "checklists",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.auditLogTable = new dynamodb.Table(this, "AuditLogTable", {
      tableName: "audit_log",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new iam.ManagedPolicy(this, "AuditLogDenyMutationPolicy", {
      managedPolicyName: "DenyAuditLogMutation",
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.DENY,
          actions: ["dynamodb:DeleteItem", "dynamodb:UpdateItem"],
          resources: [this.auditLogTable.tableArn],
        }),
      ],
    });

    this.lockoutTable = new dynamodb.Table(this, "LockoutTable", {
      tableName: "auth_lockout",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // -------------------------------------------------------------------------
    // S3 buckets
    // -------------------------------------------------------------------------
    this.imagesTempBucket = new s3.Bucket(this, "ImagesTempBucket", {
      bucketName: `discharge-images-temp-${cdk.Aws.ACCOUNT_ID}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [{ id: "delete-after-24h", enabled: true, expiration: cdk.Duration.hours(24) }],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.exportsBucket = new s3.Bucket(this, "ExportsBucket", {
      bucketName: `discharge-exports-${cdk.Aws.ACCOUNT_ID}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const spaBucket = new s3.Bucket(this, "SpaBucket", {
      bucketName: `discharge-checklist-spa-${cdk.Aws.ACCOUNT_ID}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // -------------------------------------------------------------------------
    // SES + Cognito lockout triggers
    // -------------------------------------------------------------------------
    const sesFromAddress = this.node.tryGetContext("sesFromAddress") ?? "no-reply@example.com";

    new ses.EmailIdentity(this, "LockoutEmailIdentity", {
      identity: ses.Identity.email(sesFromAddress),
    });

    const triggerRole = new iam.Role(this, "LockoutTriggerRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
      ],
    });
    this.lockoutTable.grantReadWriteData(triggerRole);
    triggerRole.addToPolicy(new iam.PolicyStatement({
      actions: ["ses:SendEmail", "ses:SendRawEmail"],
      resources: ["*"],
    }));

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
      environment: { LOCKOUT_TABLE_NAME: this.lockoutTable.tableName },
    });

    // -------------------------------------------------------------------------
    // Cognito User Pool
    // -------------------------------------------------------------------------
    this.userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: "discharge-checklist-users",
      selfSignUpEnabled: true,
      signInAliases: { username: true, email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { sms: false, otp: true },
      lambdaTriggers: {
        preAuthentication: preAuthLambda,
        postAuthentication: postAuthLambda,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.userPoolClient = this.userPool.addClient("WebClient", {
      userPoolClientName: "discharge-checklist-web",
      authFlows: { userPassword: true, userSrp: true },
      accessTokenValidity: cdk.Duration.hours(8),
      idTokenValidity: cdk.Duration.hours(8),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
    });

    // -------------------------------------------------------------------------
    // Shared Lambda execution role for API handlers
    // -------------------------------------------------------------------------
    const apiLambdaRole = new iam.Role(this, "ApiLambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
      ],
    });

    this.checklistsTable.grantReadWriteData(apiLambdaRole);
    this.auditLogTable.grantWriteData(apiLambdaRole);
    this.imagesTempBucket.grantReadWrite(apiLambdaRole);
    this.exportsBucket.grantReadWrite(apiLambdaRole);

    apiLambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ["textract:DetectDocumentText", "textract:AnalyzeDocument"],
      resources: ["*"],
    }));
    apiLambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel"],
      resources: ["*"],
    }));

    // Deny audit log mutations (append-only)
    apiLambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      actions: ["dynamodb:DeleteItem", "dynamodb:UpdateItem"],
      resources: [this.auditLogTable.tableArn],
    }));

    // -------------------------------------------------------------------------
    // Common Lambda environment
    // -------------------------------------------------------------------------
    const commonEnv = {
      IMAGES_BUCKET: this.imagesTempBucket.bucketName,
      EXPORTS_BUCKET: this.exportsBucket.bucketName,
      CHECKLISTS_TABLE: this.checklistsTable.tableName,
      AUDIT_LOG_TABLE: this.auditLogTable.tableName,
      USER_POOL_ID: this.userPool.userPoolId,
    };

    const lambdaDefaults = {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset("../backend/dist"),
      role: apiLambdaRole,
      environment: commonEnv,
    };

    // -------------------------------------------------------------------------
    // Lambda functions — one per handler
    // -------------------------------------------------------------------------
    const uploadFn = new lambda.Function(this, "UploadFn", {
      ...lambdaDefaults,
      functionName: "discharge-checklist-upload",
      handler: "handlers/uploader.uploadHandler",
      timeout: cdk.Duration.seconds(15),
    });

    const extractFn = new lambda.Function(this, "ExtractFn", {
      ...lambdaDefaults,
      functionName: "discharge-checklist-extract",
      handler: "handlers/extractor.extractHandler",
      timeout: cdk.Duration.seconds(35), // Textract can take up to 30s
    });

    const parseFn = new lambda.Function(this, "ParseFn", {
      ...lambdaDefaults,
      functionName: "discharge-checklist-parse",
      handler: "handlers/parser.parseHandler",
      timeout: cdk.Duration.seconds(15),
    });

    const checklistSaveFn = new lambda.Function(this, "ChecklistSaveFn", {
      ...lambdaDefaults,
      functionName: "discharge-checklist-save",
      handler: "handlers/checklist.saveHandler",
      timeout: cdk.Duration.seconds(10),
    });

    const checklistGetFn = new lambda.Function(this, "ChecklistGetFn", {
      ...lambdaDefaults,
      functionName: "discharge-checklist-get",
      handler: "handlers/checklist.getHandler",
      timeout: cdk.Duration.seconds(10),
    });

    const checklistUpdateFn = new lambda.Function(this, "ChecklistUpdateFn", {
      ...lambdaDefaults,
      functionName: "discharge-checklist-update",
      handler: "handlers/checklist.updateHandler",
      timeout: cdk.Duration.seconds(10),
    });

    const checklistDeleteFn = new lambda.Function(this, "ChecklistDeleteFn", {
      ...lambdaDefaults,
      functionName: "discharge-checklist-delete",
      handler: "handlers/checklist.deleteHandler",
      timeout: cdk.Duration.seconds(10),
    });

    const checklistListFn = new lambda.Function(this, "ChecklistListFn", {
      ...lambdaDefaults,
      functionName: "discharge-checklist-list",
      handler: "handlers/checklist.listHandler",
      timeout: cdk.Duration.seconds(10),
    });

    // -------------------------------------------------------------------------
    // API Gateway — REST API with Cognito authorizer
    // -------------------------------------------------------------------------
    this.api = new apigateway.RestApi(this, "DischargeChecklistApi", {
      restApiName: "discharge-checklist-api",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["Content-Type", "Authorization"],
      },
      deployOptions: { stageName: "prod" },
    });

    // Enforce HTTPS only
    this.api.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      principals: [new iam.AnyPrincipal()],
      actions: ["execute-api:Invoke"],
      resources: [this.api.arnForExecuteApi()],
      conditions: { Bool: { "aws:SecureTransport": "false" } },
    }));

    // Cognito JWT authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, "JwtAuthorizer", {
      cognitoUserPools: [this.userPool],
      authorizerName: "CognitoAuthorizer",
      identitySource: "method.request.header.Authorization",
    });

    const authOptions: apigateway.MethodOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    const integration = (fn: lambda.Function) =>
      new apigateway.LambdaIntegration(fn);

    // POST /upload-url
    const uploadUrl = this.api.root.addResource("upload-url");
    uploadUrl.addMethod("POST", integration(uploadFn), authOptions);

    // POST /extract
    const extract = this.api.root.addResource("extract");
    extract.addMethod("POST", integration(extractFn), authOptions);

    // POST /parse
    const parse = this.api.root.addResource("parse");
    parse.addMethod("POST", integration(parseFn), authOptions);

    // /checklists
    const checklists = this.api.root.addResource("checklists");
    checklists.addMethod("POST", integration(checklistSaveFn), authOptions);  // save
    checklists.addMethod("GET", integration(checklistListFn), authOptions);   // list

    // /checklists/{checklistId}
    const checklistById = checklists.addResource("{checklistId}");
    checklistById.addMethod("GET", integration(checklistGetFn), authOptions);
    checklistById.addMethod("PUT", integration(checklistUpdateFn), authOptions);
    checklistById.addMethod("DELETE", integration(checklistDeleteFn), authOptions);

    // -------------------------------------------------------------------------
    // CloudFront distribution for the React SPA
    // -------------------------------------------------------------------------
    const distribution = new cloudfront.Distribution(this, "SpaDistribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(spaBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultRootObject: "index.html",
      errorResponses: [
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" },
      ],
    });

    // -------------------------------------------------------------------------
    // Outputs
    // -------------------------------------------------------------------------
    new cdk.CfnOutput(this, "ApiUrl", { value: this.api.url, description: "API Gateway URL" });
    new cdk.CfnOutput(this, "CloudFrontUrl", { value: `https://${distribution.distributionDomainName}` });
    new cdk.CfnOutput(this, "UserPoolId", { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: this.userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "ImagesTempBucketName", { value: this.imagesTempBucket.bucketName });
    new cdk.CfnOutput(this, "ExportsBucketName", { value: this.exportsBucket.bucketName });
    new cdk.CfnOutput(this, "SpaBucketName", { value: spaBucket.bucketName });
    new cdk.CfnOutput(this, "ChecklistsTableName", { value: this.checklistsTable.tableName });
    new cdk.CfnOutput(this, "AuditLogTableName", { value: this.auditLogTable.tableName });
  }
}
