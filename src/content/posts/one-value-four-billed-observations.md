---
title: "One Value, Four Billed Observations"
deck: "The Hidden Cost of CloudWatch Container Insights"
description: "Container Insights billed 534 million observations in a month on a cluster whose metrics list looked small. Where they came from, and what replaced it."
date: 2026-09-30
updated: 2026-11-15
tags: ["AWS", "CloudWatch", "FinOps", "Observability", "DevOps"]
---

If you're running EKS with CloudWatch Container Insights, one line on the bill is worth checking closely: Observations Ingested.

On one setup, it alone accounted for over $110 a month, roughly 534 million observations, even though the metrics list in the console looked unremarkable. The CloudWatch bill for that cluster had been sitting between roughly $120 and $150 a month, and when I finally broke it down by line item, almost none of it was alarms or logs. It was the CloudWatch Observability EKS add-on — Container Insights — and specifically the metrics side of it.

![The shape of the bill, as drawn for the original note: the observations line dwarfs metrics, logs and everything else. An illustration, not the invoice; the figures in the text are the ones from the bill, and the pod-level dimension list in the drawing predates the corrected one below.](/writing/one-value-four-billed-observations/cloudwatch-observations-ingested-billing.png)

## The bill line that didn't add up

Here is the shape of one month, rounded. Alarms, a little over a dollar. API requests, inside the free tier. Metric-months, roughly $12. Observations ingested, roughly $112 — about 534 million of them, at $0.21 per million. Total, roughly $126.

The observations line was about ninety percent of the whole thing, and it was the line I understood least. I knew what a metric was and I could see how many the cluster had. I could not, at first, see how one cluster turned into half a billion of anything in thirty days.

The short way to say it is that CloudWatch charges two separate ways for metrics: a fee per metric registered and a fee per observation. That's true of CloudWatch in general, but it hides what this particular bill line is telling you. The Container Insights docs say the original version charged its metrics as custom metrics, per metric-month.[^2] Container Insights with enhanced observability for EKS instead "uses a tiered pricing model based on observations", and an observation is defined there as "a data point ingested at a single timestamp".[^1] If your bill has an Observations Ingested line under CloudWatch, you are on the second model, and the metric count stops being the number that matters.

## How one value becomes several billed observations

Container Insights doesn't call `PutMetricData`. The CloudWatch agent the add-on installs writes performance log events in Embedded Metric Format (EMF) — structured JSON log lines with an `_aws` block that tells CloudWatch Logs which fields are metrics and which fields are dimensions — and CloudWatch extracts the metrics from the log stream. The AWS docs describe it directly: from the performance log events, "CloudWatch creates aggregated metrics at the cluster, node, pod, task, and service level".[^2]

The part that does the multiplying is in the EMF specification. A metric directive carries an array of *dimension sets*, and the spec says: "Every DimensionSet used creates a new metric in CloudWatch."[^3] One log line, one value, several dimension sets, several metrics. And because an observation is one data point for one metric at one timestamp, each of those metrics gets its own observation every time the line is written.

Container Insights uses this on purpose. Take `pod_cpu_utilization`. The metrics reference for EKS lists it under four dimension sets:[^4]

- `PodName`, `Namespace`, `ClusterName`
- `Namespace`, `ClusterName`
- `Service`, `Namespace`, `ClusterName`
- `ClusterName`

So a pod's CPU reading is published once per pod, once rolled up to its namespace, once rolled up to its service, and once rolled up to the cluster. One value, four billed observations. `pod_memory_utilization`, `pod_network_rx_bytes`, `pod_network_tx_bytes` and the `_over_pod_limit` variants carry the same four sets. The node utilization metrics carry two. This is what makes the console dashboards work without you writing any queries, and it is also what you are paying for.

> [!note] The rollups are the product, and the product is billed
> Nothing here is a misconfiguration. Container Insights ships the same reading at every level the dashboards need, and the billing model counts each level as its own data point. Turning on the add-on means opting into that arithmetic.

## What the metric count actually was

The note I kept from that month has the arithmetic as a formula:

```text
(pods + containers + nodes) x (cpu, memory, network, fs, ... metrics per resource) x (scrape interval) x (dimension combinations per metric)
```

Every factor in there is small. A cluster has many pods, each pod has a handful of metrics, the agent writes about one data point a minute, and each metric fans out to between one and four dimension sets. Multiply them and run it for a month of minutes — 43,200 of them — and you land in the hundreds of millions without anything looking wrong at any step.

Meanwhile the bill's metric-month line was about 42 metric-months, roughly $12. The two numbers describe different things. A metric is deduplicated by name and dimension set, so it counts once a month no matter how often it's written. An observation is every write. The dashboards, and the console's metrics list, show you the first number. The bill is dominated by the second.

That gap is why the first instinct — "we have too many metrics, let's trim the list" — doesn't land. Fewer metrics would mean fewer observations, but the fan-out and the write rate stay, so the bill shrinks in proportion to what you give up seeing. The lever that works is to stop paying per data point at all.

## Moving metrics to Prometheus and Grafana

The change was to split the two things the add-on had bundled, metrics and logs, onto separate paths and pay for each in the way that fits it.

**Metrics moved in-cluster.** I removed the CloudWatch Observability add-on from the cluster, which kills the metrics side of the cost outright, and replaced cluster and pod metrics with Prometheus and Grafana self-hosted on the same nodes, deployed as kube-prometheus-stack. Prometheus scrapes at the same or better granularity than the agent was writing, and nothing in it bills per observation. The cost is the compute it uses and the volume it writes to.

**Logs stayed in CloudWatch, but on their own path.** The add-on had been the thing shipping container logs too, so removing it meant replacing that. I installed Fluent Bit as a DaemonSet directly, independent of the add-on, shipping container logs to CloudWatch Logs. That's the part of CloudWatch that was built for this and priced sanely for it — roughly $20 to $30 a month on this cluster, which is the entire CloudWatch bill now.

**The dashboards came from three places.** Two of the standard Kubernetes views went into Grafana as they are: a node view with per-node CPU, memory, disk and network, and a pod view with per-pod usage across the cluster. For ArgoCD I enabled a `ServiceMonitor` so the Prometheus Operator in kube-prometheus-stack picks up its `/metrics` endpoint, and put a dashboard on top for sync status and app health. The per-container dashboard — CPU and memory per container within a pod, the view worth keeping on the CloudWatch side — is custom, and it ships as a ConfigMap.

> [!tip] A ConfigMap is a dashboard
> The Grafana deployment in kube-prometheus-stack runs a sidecar that watches for ConfigMaps labelled `grafana_dashboard: "1"` and auto-imports whatever dashboard JSON is in their data. So the custom dashboard lives in the GitOps repository next to everything else instead of being built by hand in the Grafana UI and lost on the next reinstall.

CloudWatch didn't leave Grafana entirely. It remains a datasource, and the one thing I later pointed at it was a public RDS dashboard from grafana.com (dashboard 25548, "AWS RDS Advanced SRE Debug") — the first RDS-specific visibility the cluster's Grafana had. That's the right division: CloudWatch is still the source of truth for metrics AWS emits about AWS-managed services. It just isn't the thing collecting a data point per pod per rollup per minute any more.

## What it cost after

The ~$112 a month in observations is gone, not reduced. CloudWatch spend on that cluster is the logging cost and nothing else.

The cost didn't vanish; it moved, and it changed shape. Prometheus needs a PersistentVolumeClaim for its TSDB and Grafana needs one for dashboards and config, and each of those is an EBS volume with its own per-GB-month price that wasn't on the bill before. But that's flat storage pricing on a handful of volumes, plus some CPU and memory on nodes that were already running. It doesn't scale with the number of pods, it doesn't scale with the number of dimension sets, and it doesn't get a new line item when someone adds a service. The net is still a large drop in observability spend, and more importantly a cost that stays put when the cluster grows.

> [!warning] Retention is now your problem
> CloudWatch kept the metrics for you. Prometheus keeps what fits on its volume for as long as you tell it to. The flat cost comes with a knob — retention, volume size, or both — that someone has to own.

## Takeaways

- The number of metrics on a dashboard tells you almost nothing about what you're billed for. Under the observation model, the bill is writes, not names, and each dimension set is a separate write.
- Container Insights publishes a pod reading at four levels by design — pod, namespace, service, cluster. The console shows one. You pay for four.
- Trimming container-level metrics is the wrong lever. It cuts cost by removing the right-sizing data you wanted most. Changing who collects the metrics cuts it without the trade.
- Decouple logs from metrics before you remove the add-on. Fluent Bit as a DaemonSet keeps CloudWatch Logs working on its own, and CloudWatch is a good home for logs.
- Self-hosted Prometheus is flat EBS and compute, not a fee that grows with the cluster. It also means retention is a decision you now make, rather than one CloudWatch made for you.

[^1]: [Amazon CloudWatch Pricing](https://aws.amazon.com/cloudwatch/pricing/), Container Insights section. The $0.21 per million observations figure appears there as a worked example and matches what this bill showed; the page notes that volume tiers apply past one billion observations a month.
[^2]: [Container Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/ContainerInsights.html), AWS documentation, which also states that with enhanced observability for EKS "metrics and logs are charged per observation instead of being charged per metric stored or log ingested".
[^3]: [Specification: Embedded metric format](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format_Specification.html), DimensionSet array. The same section warns that "the embedded metric format will by design create a custom metric corresponding to each unique dimension combination".
[^4]: [Amazon EKS and Kubernetes Container Insights metrics](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Container-Insights-metrics-EKS.html), the dimensions column for `pod_cpu_utilization`.
