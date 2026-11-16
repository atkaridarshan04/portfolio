---
title: "Your Config Rules Are Firing. Nobody Is Fixing Them"
deck: "Auto-Remediation with EventBridge and Lambda"
description: "A NON_COMPLIANT Config rule is a record, not a fix. How an EventBridge pattern and a dispatch-table Lambda turn four managed rules into fixes and alerts."
date: 2026-10-28
updated: 2026-11-15
tags: ["AWS", "AWS Config", "EventBridge", "Lambda", "Cloud Security", "DevOps"]
repo: "https://github.com/atkaridarshan04/aws-cloud-portfolio/tree/main/infra-drift-detection"
files: ["infra-drift-detection/terraform/config.tf", "infra-drift-detection/terraform/eventbridge.tf", "infra-drift-detection/terraform/lambda.tf", "infra-drift-detection/terraform/iam.tf", "infra-drift-detection/terraform/lambda/remediator.py", "infra-drift-detection/docs/concepts.md"]
---

Most teams set up AWS Config rules, get the alerts, and then nothing happens. The violation sits there. Someone adds it to the backlog. The backlog doesn't move. Three weeks later the same bucket still has public access enabled.

Config rules without a remediation path are just a list of things you already know are wrong.

## A firing rule is a record, not a fix

Config does three things, and it's worth being precise about where the third one stops. It records: every time a resource it tracks changes, it writes a configuration item — a timestamped snapshot of the full configuration — to the delivery bucket. It evaluates: it runs each rule against the current configuration item and marks the resource `COMPLIANT` or `NON_COMPLIANT`. And it notifies: when a resource's compliance status changes, it emits an event onto EventBridge's default bus.

That is the whole contract. Nothing in it touches a resource. A `NON_COMPLIANT` bucket is a row in the Config console and an event that went onto a bus, and if nothing is subscribed to that event, the row is where the story ends. The console makes this easy to misread: a red count against `s3-bucket-public-read-prohibited` looks like the security system working, and it is — the detection half of it. The remediation half is a separate thing you have to build, and teams that don't build it end up with the three-week-old bucket from the opening paragraph: detected on day one, fixed never.

Config does ship a native remediation hook — attach an SSM Automation document to a rule and Config runs it on violation. I didn't use it, for reasons that come up below; the point here is only that it's off unless you turn it on. Detection is the default. Remediation never is.

## The mechanism, end to end

The project is one account, one region, four managed rules: `s3-bucket-versioning-enabled`, `s3-bucket-public-read-prohibited`, `restricted-ssh` and `root-account-mfa-enabled`. The path from a bad change to a fix runs through four services, each doing one job.

**Config records and evaluates.** The recorder is set to continuous recording, so a change is written as a new configuration item as it happens rather than batched into a daily snapshot, and only for three resource types — `AWS::S3::Bucket`, `AWS::EC2::SecurityGroup` and `AWS::IAM::User`. Change-triggered evaluation is what matters here: Config sees the API call via CloudTrail, records the new state and re-runs the rules scoped to that resource type. In the repo's tests the gap between making the change and the Lambda firing is two to three minutes.

**Config emits a compliance change.** Only a transition produces an event — a resource going from `COMPLIANT` to `NON_COMPLIANT`, or back. The event lands on the default bus with `source: aws.config` and `detail-type: Config Rules Compliance Change`, and its `detail` carries `configRuleName`, `resourceType`, `resourceId` and `newEvaluationResult`.

**EventBridge filters and invokes.** The rule pattern matches on three fields and nothing else: the source, the detail type and `newEvaluationResult.complianceType = NON_COMPLIANT`. A resource coming back into compliance produces an event too; the pattern drops it before any function runs. This filter-at-the-router property is why I put EventBridge in the middle instead of having Config publish straight to an SNS topic: with the topic, the Lambda is invoked for every Config notification — snapshots, history deliveries, compliant transitions — and has to decide inside the handler whether it cares. With the pattern, it is only ever invoked for a violation.

**Lambda dispatches on the rule name.** The function reads the rule name out of the event, looks it up in a dictionary, and calls whatever handler is registered: re-enable versioning, put the four-flag public access block back, revoke the port-22 ingress. Then it publishes one SNS message, whichever branch it took, with the rule, the resource, the action taken and the time.

What the Lambda is *allowed* to do is the half of this I'd argue matters most, and it's set in IAM, not in Python. The role carries `AWSLambdaBasicExecutionRole` for logs and one inline policy with exactly five actions: `s3:PutBucketVersioning`, `s3:PutBucketPublicAccessBlock`, `ec2:DescribeSecurityGroups`, `ec2:RevokeSecurityGroupIngress`, and `sns:Publish` on the one topic. No `s3:DeleteBucket`, no `s3:GetObject`, no `ec2:AuthorizeSecurityGroupIngress`, no `iam:*`. It can tighten three specific settings and talk to one topic. A handler bug that tries anything else gets an access-denied error, not an incident.

## The design, from the repo

Everything below is in [infra-drift-detection](https://github.com/atkaridarshan04/aws-cloud-portfolio/tree/main/infra-drift-detection), deployed with Terraform; there is a console walkthrough too, building the same resources by hand. The recorder is where "continuous" and the resource-type scope are set:

```hcl title="infra-drift-detection/terraform/config.tf"
resource "aws_config_configuration_recorder" "main" {
  name     = "default"
  role_arn = aws_iam_service_linked_role.config.arn

  recording_group {
    all_supported                 = false
    include_global_resource_types = false
    resource_types = [
      "AWS::S3::Bucket",
      "AWS::EC2::SecurityGroup",
      "AWS::IAM::User",
    ]
  }

  recording_mode {
    recording_frequency = "CONTINUOUS"
  }
}
```

Each rule is a managed rule with a `source_identifier` and a scope. The SSH one is the only place the rule name and the identifier differ:

```hcl title="infra-drift-detection/terraform/config.tf"
resource "aws_config_config_rule" "restricted_ssh" {
  name = "restricted-ssh"

  source {
    owner             = "AWS"
    source_identifier = "INCOMING_SSH_DISABLED"
  }

  scope {
    compliance_resource_types = ["AWS::EC2::SecurityGroup"]
  }

  depends_on = [aws_config_configuration_recorder_status.main]
}
```

`root-account-mfa-enabled` is declared the same way minus the `scope` block, because it evaluates the account rather than a resource type.

The EventBridge rule is the entire routing layer. Three matched fields, one target:

```hcl title="infra-drift-detection/terraform/eventbridge.tf"
resource "aws_cloudwatch_event_rule" "noncompliant" {
  name        = "config-noncompliant-to-lambda"
  description = "Routes Config NON_COMPLIANT findings to the remediator Lambda"

  event_pattern = jsonencode({
    source        = ["aws.config"]
    "detail-type" = ["Config Rules Compliance Change"]
    detail = {
      newEvaluationResult = {
        complianceType = ["NON_COMPLIANT"]
      }
    }
  })
}

resource "aws_cloudwatch_event_target" "remediator" {
  rule = aws_cloudwatch_event_rule.noncompliant.name
  arn  = aws_lambda_function.remediator.arn
}
```

The target alone isn't enough; the function also has to let `events.amazonaws.com` invoke it, and that permission is scoped to this one rule's ARN, so nothing else on the bus can call the remediator:

```hcl title="infra-drift-detection/terraform/lambda.tf"
resource "aws_lambda_permission" "eventbridge_invoke" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.remediator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.noncompliant.arn
}
```

On the Lambda side, the dispatch table is the design. A rule maps to a handler or to `None`, and `None` is a first-class answer:

```python title="infra-drift-detection/terraform/lambda/remediator.py"
HANDLERS = {
    's3-bucket-versioning-enabled':     remediate_s3_versioning,
    's3-bucket-public-read-prohibited': remediate_s3_public_access,
    'restricted-ssh':                   remediate_ssh,
    'root-account-mfa-enabled':         None,  # cannot be automated
}
```

The handler separates "known rule, deliberately not automated" from "rule I've never heard of", and both end in an alert rather than an exception:

```python title="infra-drift-detection/terraform/lambda/remediator.py"
    handler = HANDLERS.get(rule_name)

    if handler is None and rule_name in HANDLERS:
        action = "Cannot auto-remediate. Manual action required."
        notify(rule_name, resource_type, resource_id, region, action, auto_remediated=False)
        return

    if handler is None:
        action = f"Unknown rule '{rule_name}'. No remediation defined."
        notify(rule_name, resource_type, resource_id, region, action, auto_remediated=False)
        return

    action = handler(resource_id)
    notify(rule_name, resource_type, resource_id, region, action, auto_remediated=True)
```

The unknown-rule branch exists because the EventBridge pattern doesn't filter on rule name. Add a fifth Config rule to the account and the Lambda is invoked for its violations too; the alert says so, instead of the function dying on a `KeyError` or, worse, quietly doing nothing.

The SSH handler is the one with real logic in it. It describes the group, walks the ingress rules, and revokes only the port-22 entries whose source is `0.0.0.0/0` or `::/0` — a rule allowing 22 from an office range is left alone:

```python title="infra-drift-detection/terraform/lambda/remediator.py"
    for rule in sg.get('IpPermissions', []):
        if rule.get('FromPort') == 22 and rule.get('ToPort') == 22:
            open_ipv4 = [r for r in rule.get('IpRanges', [])   if r['CidrIp']   == '0.0.0.0/0']
            open_ipv6 = [r for r in rule.get('Ipv6Ranges', []) if r['CidrIpv6'] == '::/0']
            if open_ipv4 or open_ipv6:
                permission = {'IpProtocol': rule['IpProtocol'], 'FromPort': 22, 'ToPort': 22}
                if open_ipv4:
                    permission['IpRanges'] = open_ipv4
                if open_ipv6:
                    permission['Ipv6Ranges'] = open_ipv6
                try:
                    ec2.revoke_security_group_ingress(GroupId=resource_id, IpPermissions=[permission])
                    revoked.append('0.0.0.0/0' if open_ipv4 else '::/0')
                except ec2.exceptions.ClientError as e:
                    if 'InvalidPermission.NotFound' not in str(e):
                        raise
```

The `InvalidPermission.NotFound` catch is the idempotency guard. EventBridge delivers at least once, so the same violation can invoke the function twice; the second run finds the rule already gone and treats that as success. The two S3 handlers are idempotent for free — putting `Enabled` on an already-versioned bucket, or the same four flags on an already-blocked one, is a no-op.

> [!tip] Why not Config's own remediation
> Config can run an SSM Automation document per rule, and for fleet-wide governance that is a reasonable answer. I wanted the per-rule decision in one place — fix this, alert on that, say exactly what happened in the message — and a function I can invoke with a saved event. The automation document gives you one behaviour per rule and a Config notification; the Lambda gives you the dispatch table above.

## What a drift-and-fix looks like running

The repo's first end-to-end test is the versioning rule, because a brand-new bucket is non-compliant by default. Create one in the console, named `drift-test-bucket`, and leave versioning off. Two to three minutes later the bucket is listed as Noncompliant under the rule's resources in scope, and the remediator's log stream has this — the same text the SNS email carries, trimmed of its region and time lines:

```text
COMPLIANCE VIOLATION — AUTO-REMEDIATED
Rule:     s3-bucket-versioning-enabled
Resource: AWS::S3::Bucket / drift-test-bucket
Action:   Versioning re-enabled on bucket 'drift-test-bucket'.
```

The bucket's properties now show versioning Enabled, and on the next evaluation the rule flips back to Compliant. That flip is a compliance change too — a `COMPLIANT` event goes onto the bus — and the pattern discards it. The fix doesn't re-trigger the pipeline, which is the first thing I check in any remediation loop.

The security-group test shows the handler doing more than one API call. A group with SSH open to `0.0.0.0/0` has the rule revoked and logs:

```text
COMPLIANCE VIOLATION — AUTO-REMEDIATED
Rule:     restricted-ssh
Resource: AWS::EC2::SecurityGroup / sg-xxxxxxxxxxxxxxxxx
Action:   Revoked port 22 ingress from 0.0.0.0/0 on security group 'sg-xxxxxxxxxxxxxxxxx'.
```

The root MFA rule, if the account's root user has no MFA, produces the other kind of message — `[MANUAL ACTION REQUIRED] Config violation: root-account-mfa-enabled` in the subject — and nothing else. If root already has MFA, the rule is Compliant, no event is emitted and the Lambda never runs. Both are correct. And a resource that stays non-compliant across re-evaluations does not keep paging: per the [AWS Config documentation](https://docs.aws.amazon.com/config/latest/developerguide/monitor-config-with-cloudwatchevents.html), the compliance change notification is emitted when a resource's compliance type has changed, so the alert is per transition, not per evaluation.

![The pipeline as deployed: Config with continuous recording evaluates four managed rules, NON_COMPLIANT transitions reach the EventBridge rule, the remediator Lambda fixes the test bucket and security group and publishes to the compliance-alerts topic, with CloudWatch Logs as the audit trail.](/writing/your-config-rules-are-firing-nobody-is-fixing-them/aws-config-auto-remediation-eventbridge-lambda.png)

> [!warning] The delivery bucket policy fails first
> Config will not start the recorder unless the delivery bucket's policy lets `config.amazonaws.com` call `s3:GetBucketAcl` on the bucket and `s3:PutObject` under `AWSLogs/<account>/Config/`, with `bucket-owner-full-control` and a `SourceAccount` condition. Without it the recorder fails with "Insufficient delivery policy". The Terraform in `config.tf` declares the policy alongside the recorder, with nothing forcing the order; in the console you write it by hand before the setup wizard.

## Where auto-remediation should stop

The rule I used for deciding what to automate: fix it automatically only when the correct action is unambiguous regardless of context and the fix is reversible. Alert when the fix could break something, needs a human judgement, or can't be done through an API at all.

Versioning clears that bar without argument — enabling it only adds protection. The public access block almost clears it; the exception is a bucket that is public on purpose, a static site, and the honest answer in the repo's notes is that this project blocks every violation and a production version would check for a tag like `public-access=intentional` and alert instead. Root MFA fails the bar for a different reason: there is no API call for it. MFA on root needs a device and a person, which is why its entry in the table is `None` rather than a handler that tries.

The SSH rule is the one I'd be most careful about, and the repo is explicit that it is automated with a known cost. Revoking `0.0.0.0/0` on 22 closes a hole, but if someone opened it on purpose to reach an instance, the Lambda locks them out, and will do so again every time they re-add the rule. I accept that — the fix is a bastion or Session Manager, not world-open SSH — but it's a decision, not a free action. A security group rule can be load-bearing in ways its port number doesn't tell you.

Three things bound the blast radius if that decision is wrong. The IAM policy means the function can only tighten the three settings it knows about; it cannot delete, open, or touch IAM. The `NON_COMPLIANT`-only pattern means a fix cannot feed back into another invocation. And every branch, including the one that does nothing, publishes to SNS, so a wrong fix is at least a visible wrong fix.

What this project doesn't have is a pause. For a remediation that carries real risk, the next step is a Step Functions workflow in front of the handler: detect, publish an approval request, wait, then apply. Same event, same dispatch table, with a human between the two for the rules that warrant it. That, plus SCPs to prevent the changes that should never happen at all, is the difference between this single-account pipeline and a governance setup — the pattern doesn't change, the gates do.

## Takeaways

- A `NON_COMPLIANT` evaluation is a record and an event. Nothing in Config's contract changes a resource; if nothing subscribes to the event, detection is where it ends.
- Filter at the router. A pattern that matches only `NON_COMPLIANT` means the function is never invoked for compliant transitions, snapshots or history deliveries, and it's what stops a fix from re-triggering the pipeline.
- Put the fix-or-alert decision in a table, and make "no handler" a legitimate entry. Unknown rules alert instead of crashing; root MFA alerts instead of pretending.
- The IAM policy is the real safety boundary. Five actions, no delete, no authorize, no IAM: a bug in a handler is an access-denied, not an incident.
- Automate only what is unambiguous and reversible. For the rest, the next thing to add is an approval step, not a cleverer handler.
