#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DischargeChecklistStack } from "../src/discharge-checklist-stack";

const app = new cdk.App();
new DischargeChecklistStack(app, "DischargeChecklistStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
});
