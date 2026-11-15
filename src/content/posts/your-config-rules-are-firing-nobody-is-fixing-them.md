---
title: "Your Config Rules Are Firing. Nobody Is Fixing Them"
deck: "Auto-Remediation with EventBridge and Lambda"
description: "Most teams set up AWS Config rules, get the alerts, and then nothing happens. The violation sits there. Someone adds it to the backlog. The backlog doesn't move. Three weeks later…"
date: 2026-10-28
tags: ["AWS", "AWS Config", "EventBridge", "Lambda", "Cloud Security", "DevOps"]
repo: "https://github.com/atkaridarshan04/aws-cloud-portfolio/tree/main/infra-drift-detection"
source: "Tech/LinkedIn Posts/AWS/Your Config Rules Are Firing. Nobody Is Fixing Them - Auto-Remediation with EventBridge and Lambda.md"
---

Most teams set up AWS Config rules, get the alerts, and then nothing happens. The violation sits there. Someone adds it to the backlog. The backlog doesn't move. Three weeks later the same bucket still has public access enabled.

Config rules without a remediation path are just a list of things you already know are wrong.

The fix is wiring the detection to the remediation so a violation doesn't wait for a human to notice it. The pipeline is four services doing one job each:

AWS Config continuously evaluates resource configurations against rules. The moment a resource goes non-compliant — an S3 bucket gets public access re-enabled, versioning gets disabled, a security group opens port 22 to the world — Config emits a compliance change event.

EventBridge filters for `NON_COMPLIANT` on those events and routes them straight to a Lambda. Not a CloudWatch alarm, not a notification that someone has to read first — an event that fires a function.

The Lambda looks at which rule fired and which resource triggered it, then applies the fix: re-enable versioning, put the public access block back, revoke the ingress rule. Same correct configuration every time, no human deciding what "fixed" looks like under pressure.

SNS handles the notification — not as the trigger, but as the audit trail. Every remediation sends a message: what rule fired, which resource, what action was taken, when. The team knows what happened without needing to go check.

One design decision worth calling out: not everything gets auto-remediated. Root account MFA is one of the four rules here, and Lambda can't programmatically enable MFA on the root account — that's a manual action by definition. So that one sends an alert instead. Auto-remediation only covers fixes that are safe and reversible: re-enabling versioning doesn't break anything, blocking public access on a bucket that shouldn't be public in the first place doesn't break anything. Revoking a security group rule that might be load balancer health check traffic would. The rule is: automate the safe ones, alert on the rest.

The other choice worth noting is EventBridge over Config's built-in SSM Automation remediation. Config does have native remediation — but EventBridge + Lambda gives you actual control: conditional logic, custom notifications, local testing, the ability to decide per-rule whether to fix or alert rather than being locked into one behavior for everything.

The result is a compliance posture that's continuous, not periodic. Not "we audit quarterly and hope nothing slipped through" but "every violation is detected within minutes and either fixed automatically or surfaced immediately."

Full implementation — Config rules, EventBridge rule, Lambda remediator, Terraform — here: https://github.com/atkaridarshan04/aws-cloud-portfolio/tree/main/infra-drift-detection

How are others handling Config rule violations — auto-remediation, alerts only, or something in between?

![aws config auto remediation eventbridge lambda](/writing/your-config-rules-are-firing-nobody-is-fixing-them/aws-config-auto-remediation-eventbridge-lambda.png)
