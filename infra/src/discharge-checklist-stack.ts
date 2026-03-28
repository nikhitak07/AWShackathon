import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as ses from "aws-cdk-lib/aws-ses";
import * as path from "path";
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
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
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

    const preAuthLambda = new lambdaNodejs.NodejsFunction(this, "PreAuthLockoutTrigger", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, "../../backend/src/auth/lockoutTriggers.ts"),
      handler: "preAuthHandler",
      role: triggerRole,
      timeout: cdk.Duration.seconds(10),
      environment: {
        LOCKOUT_TABLE_NAME: this.lockoutTable.tableName,
        SES_FROM_ADDRESS: sesFromAddress,
      },
      bundling: { externalModules: [] },
    });

    const postAuthLambda = new lambdaNodejs.NodejsFunction(this, "PostAuthLockoutTrigger", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, "../../backend/src/auth/lockoutTriggers.ts"),
      handler: "postAuthHandler",
      role: triggerRole,
      timeout: cdk.Duration.seconds(10),
      environment: { LOCKOUT_TABLE_NAME: this.lockoutTable.tableName },
      bundling: { externalModules: [] },
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
      mfa: cognito.Mfa.OFF,
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
      actions: ["rekognition:DetectText"],
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

    // -------------------------------------------------------------------------
    // Common Lambda config
    // -------------------------------------------------------------------------
    const backendEntry = path.resolve(__dirname, "../../backend/src");

    const nodejsDefaults: Omit<lambdaNodejs.NodejsFunctionProps, "entry" | "handler"> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      role: apiLambdaRole,
      environment: commonEnv,
      bundling: {
        externalModules: [], // bundle everything including node_modules
        tsconfig: path.resolve(__dirname, "../../backend/tsconfig.json"),
      },
    };

    const fn = (entry: string, handler: string, timeout = 15) =>
      new lambdaNodejs.NodejsFunction(this, handler.replace(/\./g, "_"), {
        ...nodejsDefaults,
        entry: path.join(backendEntry, entry),
        handler,
        timeout: cdk.Duration.seconds(timeout),
      });

    // -------------------------------------------------------------------------
    // Lambda functions
    // -------------------------------------------------------------------------
    const uploadFn = fn("handlers/uploader.ts", "uploadHandler");
    const extractFn = fn("handlers/extractor.ts", "extractHandler", 35);
    const parseFn = fn("handlers/parser.ts", "parseHandler", 30);
    const checklistSaveFn = fn("handlers/checklist.ts", "saveHandler", 10);
    const checklistGetFn = fn("handlers/checklist.ts", "getHandler", 10);
    const checklistUpdateFn = fn("handlers/checklist.ts", "updateHandler", 10);
    const checklistDeleteFn = fn("handlers/checklist.ts", "deleteHandler", 10);
    const checklistListFn = fn("handlers/checklist.ts", "listHandler", 10);

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

    // Add CORS headers to gateway-level error responses (401, 403, 500, etc.)
    // so CORS errors don't mask the real error in the browser
    const gatewayResponseTypes = [
      apigateway.ResponseType.UNAUTHORIZED,
      apigateway.ResponseType.ACCESS_DENIED,
      apigateway.ResponseType.DEFAULT_4XX,
      apigateway.ResponseType.DEFAULT_5XX,
    ];
    for (const responseType of gatewayResponseTypes) {
      this.api.addGatewayResponse(`GatewayResponse${responseType.responseType}`, {
        type: responseType,
        responseHeaders: {
          "Access-Control-Allow-Origin": "'*'",
          "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
        },
      });
    }

    // Cognito JWT authorizer — attach after API is defined to avoid circular dep
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, "JwtAuthorizer", {
      cognitoUserPools: [this.userPool],
      authorizerName: "CognitoAuthorizer",
      identitySource: "method.request.header.Authorization",
    });
    authorizer._attachToApi(this.api);    const authOptions: apigateway.MethodOptions = {
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
