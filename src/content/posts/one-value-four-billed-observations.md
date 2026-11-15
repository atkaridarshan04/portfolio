---
title: "One Value, Four Billed Observations"
deck: "The Hidden Cost of CloudWatch Container Insights"
description: "If you're running EKS with CloudWatch Container Insights, one line on the bill is worth checking closely: Observations Ingested."
date: 2026-09-30
tags: ["AWS", "CloudWatch", "FinOps", "Observability", "DevOps"]
source: "Tech/LinkedIn Posts/AWS/One Value, Four Billed Observations - The Hidden Cost of CloudWatch Container Insights.md"
---

If you're running EKS with CloudWatch Container Insights, one line on the bill is worth checking closely: Observations Ingested.

On one setup, it alone accounted for over $110 a month, roughly 534 million observations, even though the metrics list in the console looked unremarkable.

CloudWatch charges for this two separate ways: a monthly fee per metric registered, and a separate fee per observation — one data point for one metric at one point in time. Container Insights doesn't call the metrics API directly, it ships data as EMF (Embedded Metric Format) log lines, and CloudWatch extracts a metric for every dimension combination in each line.

That's the part that isn't obvious: a single log line publishes the same reading at multiple rollup levels at once. A pod's CPU usage gets published at the cluster level, cluster+namespace, cluster+namespace+service, and cluster+namespace+service+pod — one value, four billed observations. Multiply that across every metric, every container, every pod, once a minute, all day, and a modest-looking metrics list turns into hundreds of millions of observations a month.

Dropping container-level metrics cuts the bill, but that's usually the wrong lever — those are exactly the numbers used to right-size resource requests and limits, so you're trading cost for the visibility you need most.

One way of dealing with this: get off per-observation billing entirely — move metrics to self-hosted Prometheus and Grafana, and that cost mostly disappears. What's left is flat EBS storage and compute on nodes you already have, not a fee that grows with every pod and dimension. CloudWatch stays in the picture for what it's actually built for: centralized logs.

The number of metrics on a dashboard tells you almost nothing about what you're being billed for. It's the dimensions and rollups behind them that decide the real cost.

Has anyone else run into this with Container Insights, or found a similarly disproportionate line item on a different AWS service?

![cloudwatch observations ingested billing](/writing/one-value-four-billed-observations/cloudwatch-observations-ingested-billing.png)
