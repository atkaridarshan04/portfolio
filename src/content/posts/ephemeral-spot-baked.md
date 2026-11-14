---
title: "Ephemeral, Spot, Baked"
deck: "Self-Hosted GitHub Actions Runners on AWS That Actually Make Sense"
description: "How I run one-job-per-instance GitHub Actions runners on EC2 Spot from a Packer-baked AMI: the webhook-to-terminate lifecycle, the Terraform behind it, and what it costs."
date: 2026-10-26
updated: 2026-11-14
tags: ["GitHub Actions", "AWS", "Terraform", "CI/CD", "DevOps"]
repo: "https://github.com/atkaridarshan04/aws-github-runners"
files:
  - terraform/main.tf
  - terraform/variables.tf
  - docs/02-setup-guide.md
  - docs/05-operations.md
  - scripts/download-lambda-packages.sh
  - .github/workflows/ci.yml
  - docs/01-concepts.md
---

GitHub-hosted runners are easy to start with. They're also quietly expensive once you're past the free tier, and they have a queueing problem nobody talks about until it hits: push during a spike in traffic and your job sits waiting for a shared runner that isn't yours.

The obvious answer is self-hosted runners. The less obvious part is that "self-hosted" done naively just trades one problem for another — now you have a long-running EC2 instance sitting idle between jobs, whatever it installed for job #1 still present for job #47, and an always-on cost that doesn't go away when nothing's building. I built a Terraform and Packer blueprint that avoids both failure modes. This is the mechanism behind it, and the three configuration decisions that make it work.

![The three decisions — ephemeral over persistent, Spot over on-demand, baked AMI over bootstrap script — and the five-component pipeline from a push to a self-terminating runner](/writing/ephemeral-spot-baked/self-hosted-github-runners-aws-overview.png)

## What the default options get wrong

GitHub-hosted runners have three problems once you're past trivial usage: a shared queue during traffic spikes, capped minutes and cost on private repos, and no control over what's pre-installed on the box, so every job re-installs the same tools. Self-hosting fixes all three at the cost of owning the infrastructure.

The naive way to own that infrastructure is a persistent runner: an EC2 instance that polls for jobs and runs them one after another. That's an always-on attack surface, because state from one job — caches, credentials a prior job used — is still on disk for the next one unless you clean it carefully. It's also an always-on cost, because you pay for idle time unless you build your own scale-to-zero.

The fix isn't hand-rolled infrastructure. The community-maintained [`github-aws-runners/terraform-aws-github-runner`](https://github.com/github-aws-runners/terraform-aws-github-runner) module already implements the autoscaling, the webhook handling and the runner lifecycle. What's left to you is configuration, and three choices in that configuration compound: ephemeral instead of persistent, Spot instead of on-demand, and a baked AMI instead of a bootstrap script. Each one makes the next one safer.

## The lifecycle of one job

The path from a push to a terminated instance has five components, each doing one thing:

1. A developer pushes or opens a PR, and GitHub detects a workflow trigger.
2. The GitHub App fires a `workflow_job` webhook at an API Gateway endpoint.
3. The webhook Lambda validates the webhook signature and enqueues the job. Signature checking — and therefore the webhook secret — stays out of the scaling path.
4. The scale-up Lambda launches an EC2 Spot instance from the custom AMI. This is the actual autoscaling: no idle fleet, no ASG polling loop.
5. The runner boots, registers with GitHub, picks up the job, runs it, deregisters and terminates.

### Why ephemeral

`enable_ephemeral_runners = true` in the module wrapper becomes an `ENABLE_EPHEMERAL_RUNNERS` environment variable on the scale-up Lambda and an `agent_mode` SSM parameter set to `ephemeral`, which the start script reads at boot. In that mode the runner binary starts in the foreground with a just-in-time config — the module's default for ephemeral runners — rather than being installed as a service. When `run.sh` returns, the script's `EXIT` trap stops the CloudWatch agent and calls `terminate-instances` on the instance it's running on:

```bash title="upstream module: modules/runners/templates/start-runner.sh"
  # allows to flush the cloud watch logs and traces
  sleep 10
  if [ "$agent_mode" = "ephemeral" ] || [ "$exit_code" -ne 0 ]; then
    echo "Stopping CloudWatch service"
    systemctl stop amazon-cloudwatch-agent.service || true
    echo "Terminating instance"
    aws ec2 terminate-instances \
      --instance-ids "$instance_id" \
      --region "$region" \
      || true
  fi
}

trap 'cleanup $? $LINENO $BASH_LINENO' EXIT
```

The same trap fires on a non-zero exit, so a runner that fails to start also removes itself. Nothing survives between jobs, and you pay only for the minutes a job actually runs. A scheduled scale-down Lambda sweeps every five minutes as a safety net for runners that registered but never picked up a job; the module tolerates a slow boot up to `runner_boot_time_in_minutes` (default five) before treating an instance as orphaned.

### Why Spot stops being risky

Spot interruptions are a problem when you lose a long-running process. An ephemeral runner is already supposed to die when the job finishes, so an interruption just means one job retries on a fresh instance. Short-lived, stateless, retry-safe — that is the textbook Spot workload, and the README puts the saving at routinely ~70% cheaper than on-demand.

### Why a baked AMI

A stock Ubuntu AMI needs Docker, the runner binary and your build tools installed at boot through `user_data`. The upstream module's own documentation is blunt about the cost of skipping the prebuilt image: downloading the runner binary from github.com, without the S3 binary cache, "can occasionally take more than 10 minutes."[^1] Baking everything into the AMI ahead of time removes that install step entirely. What's left at boot is EC2 launch time, runner-service startup and the registration handshake — a matter of seconds to low tens of seconds on Linux, depending on instance type, AMI size and region. The upstream project doesn't publish a hard number, and neither do I; the section on measuring it is below.

## The Terraform

The whole fleet is one module block in `terraform/main.tf`, driven by `terraform.tfvars` for region, account, project name, VPC and subnets. The GitHub App credentials are read from Secrets Manager at plan time, never from tfvars. The parts that implement the three decisions:

```hcl title="terraform/main.tf"
  runner_os           = "linux"
  runner_architecture = "x64"
  runner_run_as       = "ubuntu"
  runner_extra_labels = var.runner_extra_labels

  # Spot for cost, price-capacity-optimized for fewer interruptions.
  instance_types                = var.instance_types
  instance_target_capacity_type = "spot"
  instance_allocation_strategy  = "price-capacity-optimized"

  runners_maximum_count           = var.runners_maximum_count
  create_service_linked_role_spot = var.create_service_linked_role_spot
  enable_organization_runners     = var.enable_organization_runners
  enable_ephemeral_runners        = true
  enable_ssm_on_runners           = true  # shell access via Session Manager (docs/02-setup-guide.md)
  enable_userdata                 = false # not needed — everything is baked into the AMI
  scale_down_schedule_expression  = var.scale_down_schedule_expression
  minimum_running_time_in_minutes = var.minimum_running_time_in_minutes
```

`instance_types` is a preference list — `t3a.medium`, `c5a.large`, `c6a.large`, `t3.medium`, `c5.large`, `c6i.large` by default — and `price-capacity-optimized` is the allocation strategy the wrapper chooses for fewer interruptions. `enable_userdata = false` is the direct consequence of the baked AMI: there's nothing to install at boot, so the launch template carries no bootstrap script.

The AMI lookup is a name filter scoped to the owning account, so a rebuilt image is picked up by the next `terraform apply` with no variable changes:

```hcl title="terraform/main.tf"
  # Matches the AMI built by Packer
  ami = {
    filter = {
      name  = ["github-runner-ubuntu-jammy-amd64-*"]
      state = ["available"]
    }
    owners = [var.aws_account_id]
  }

  block_device_mappings = [{
    device_name           = "/dev/sda1"
    volume_size           = var.root_volume_size_gb
    volume_type           = "gp3"
    delete_on_termination = true
    encrypted             = true
  }]
```

> [!note] The Lambda code ships separately from the module
> The module's three Lambda packages — webhook, runners (scale-up and scale-down), runner-binaries-syncer — are distributed as versioned zip releases, not vendored into the module. `main.tf` pins the module to `7.11.0` and `scripts/download-lambda-packages.sh` reads that version out of `main.tf` with `awk` before fetching the matching zips, so the two can't drift. Bump the version, re-run the script, apply.

The module also creates a runner-binaries-syncer Lambda that mirrors the GitHub runner binary into S3, so an instance that does need the binary fetches it from S3 rather than github.com. With a baked AMI and `enable_userdata = false`, nothing at boot consults that copy; it sits unused.

## The AMI

I didn't write a Packer template. The upstream project ships several under `images/`, one per OS and architecture, and the Ubuntu 22.04 one does everything this fleet needs. Its shell provisioner installs Docker from Docker's own apt repository, the CloudWatch agent and AWS CLI v2, plus `jq`, `git` and `unzip`:

```hcl title="upstream module: images/ubuntu-jammy/github_agent.ubuntu.pkr.hcl"
  provisioner "shell" {
    environment_vars = [
      "DEBIAN_FRONTEND=noninteractive"
    ]
    inline = concat([
      "sudo cloud-init status --wait",
      "sudo apt-get -y update",
      "sudo apt-get -y install ca-certificates curl gnupg lsb-release",
      "sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg",
      "echo deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null",
      "sudo apt-get -y update",
      "sudo apt-get -y install docker-ce docker-ce-cli containerd.io jq git unzip",
      "sudo systemctl enable containerd.service",
      "sudo service docker start",
      "sudo usermod -a -G docker ubuntu",
      "sudo curl -f https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb -o amazon-cloudwatch-agent.deb",
      "sudo dpkg -i amazon-cloudwatch-agent.deb",
```

Two later provisioners matter more than the package list. The first runs the module's own `install-runner.sh` at build time: it downloads the runner tarball into `/opt/actions-runner`, creates `/opt/hostedtoolcache` so the `setup-*` actions have somewhere to put toolchains, and runs the runner's dependency installer. The second drops `start-runner.sh` into cloud-init's per-boot directory:

```hcl title="upstream module: images/ubuntu-jammy/github_agent.ubuntu.pkr.hcl"
  provisioner "shell" {
    inline = [
      "sudo mv /tmp/start-runner.sh /var/lib/cloud/scripts/per-boot/start-runner.sh",
      "sudo chmod +x /var/lib/cloud/scripts/per-boot/start-runner.sh",
    ]
  }
```

That is what makes `enable_userdata = false` possible. cloud-init runs the per-boot script on every launch with no `user_data` at all; the script fetches its config, starts the runner, and terminates the instance when the runner exits. The install and start scripts are the same templates the module uses for `user_data` bootstrapping of a stock AMI — the AMI just runs the install half at bake time instead of at boot.

The template hardcodes `ami_name` as `github-runner-ubuntu-jammy-amd64-<timestamp>`, which is exactly what the Terraform filter matches, so the stock template works unchanged. Extra tools go through the `custom_shell_commands` variable or a forked provisioner block — every tool baked in is one less install per job.

```bash
cd terraform-aws-github-runner/images/ubuntu-jammy
packer init github_agent.ubuntu.pkr.hcl
packer build -var "region=<REGION>" github_agent.ubuntu.pkr.hcl
```

Rebuilds are manual and infrequent: a CVE in a baked-in tool, a new runtime to pre-install, a base image point release. After a rebuild, `terraform apply` picks up the new AMI through the name filter.

> [!warning] Old AMIs and snapshots are not cleaned up
> Nothing deregisters superseded AMIs or deletes their EBS snapshots. Each rebuild leaves the previous image behind, and storage for it accrues until you remove it. A keep-last-N script is worth adding once you have a real backlog — not before.

## What it looks like running

The smoke-test workflow in the repo targets the fleet by label and checks the three properties the design promises:

```yaml title=".github/workflows/ci.yml"
        runs-on: [self-hosted, linux, x64, aws-spot]
        steps:
            - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1

            # Proves this is actually your fleet, and a fresh instance per job —
            # a persistent/reused runner would show the same instance ID across runs.
            - name: Identify the runner instance
              run: |
                  TOKEN=$(curl -fs -X PUT "http://169.254.169.254/latest/api/token" \
                    -H "X-aws-ec2-metadata-token-ttl-seconds: 60")
                  curl -fs -H "X-aws-ec2-metadata-token: $TOKEN" \
                    http://169.254.169.254/latest/meta-data/instance-id

            # Proves ephemeral behavior: a leftover marker from a prior job means
            # this instance was reused instead of freshly launched.
            - name: Confirm no state left over from a previous job
              run: |
                  test ! -f /tmp/ci-marker && echo "clean instance, no prior job state"
                  touch /tmp/ci-marker

            # Self-contained smoke test — proves Docker itself works from the AMI
            - name: Docker smoke test
              run: docker run --rm hello-world
```

Trigger it and the job sits briefly in "Waiting for a runner" while the webhook, scale-up Lambda and EC2 launch happen. Then a runner picks it up and three things should be true: the instance ID is different on every run, the marker step prints `clean instance, no prior job state`, and `docker run` starts immediately with nothing but the `hello-world` pull — no `apt install` output, no image-layer downloads for Docker itself. Package-manager output on a normal run means something is pulling from outside the AMI and is worth tracking down.

From the AWS side, the EC2 console shows an instance named `<PROJECT_NAME>-gh-runner-action-runner` go to `running` for the job and to `shutting-down` right after it finishes. CloudWatch gets one log group per Lambda, one for API Gateway access, and a `/github-self-hosted-runners/<PROJECT_NAME>-gh-runner/` family for the instance's own `messages`, `user_data`, `runner` and `runner-startup` logs, shipped by the CloudWatch agent that the AMI carries. If that last group never appears, the instance launched but didn't get far enough to register, and the scale-up Lambda's log is the next place to look.

The number that matters is queued-to-running, and GitHub's API already has it:

```bash
gh api repos/<ORG>/<REPO>/actions/runs/<RUN_ID>/jobs \
  --jq '.jobs[] | {name, created_at, started_at}'
```

The gap between `created_at` and `started_at` is the full end-to-end latency — webhook, Lambda, EC2 launch, boot, registration. Run it over a few real jobs before quoting a boot time to anyone.

## Cost and the trade-offs that come with it

Spot instances are the only meaningful variable cost, and they bill only while jobs run. Lambda is milliseconds per invocation, API Gateway is pennies per webhook call, and the S3 binary cache is minimal. The one fixed line item is a NAT Gateway if runners launch into private subnets, and it's usually the largest. For moderate usage — 50 to 100 CI jobs a day — the repo's operations notes put the runner infrastructure itself at low tens of dollars per month, excluding a NAT Gateway you'd be paying for regardless.

The trade-offs are real but bounded:

- `runners_maximum_count` (default 8) caps concurrent instances, and because runners are ephemeral it's also the cap on concurrent jobs. Jobs over the cap queue and show as Queued; nothing fails. Before raising it, check the regional Spot vCPU quota and free IPs in the runner subnets.
- `minimum_running_time_in_minutes` (default 15) is how long an instance must have run before scale-down may terminate it when idle. It isn't a limit on job length — GitHub's job timeout and Spot interruption are what actually bound a job.
- A Spot interruption retries the job. That's fine for PR checks, test suites, scans and builds. Workloads with expensive warm state — huge dependency caches, GPU driver warmup, slow license handshakes — are the case for a persistent fleet, and only for that workload. Try cache-action-backed dependency caching or a bigger instance with local NVMe first.
- `enable_organization_runners` must be `false` on a personal account. The org-level registration API doesn't exist there, and setting it `true` makes the scale-up Lambda fail on every job while the workflow sits waiting for a runner forever.

## Takeaways

- Ephemeral is what makes Spot safe. Once a runner is designed to die after one job, an interruption is a retry, not an outage.
- A baked AMI is what makes ephemeral fast. The install step moves from every boot to one Packer build, and `enable_userdata = false` is the proof that nothing is left to do at launch.
- The lifecycle is in the start script, not the Terraform. `run.sh` in the foreground plus an `EXIT` trap that terminates the instance is the whole ephemeral mechanism.
- Pin the module and let a script derive the Lambda release from the pin. Version drift between module and zips is the easiest way to break an apply.
- Measure boot latency from `created_at` to `started_at` on real jobs. The upstream project doesn't publish a number, so quote your own.

[^1]: From the [upstream module's documentation](https://github.com/github-aws-runners/terraform-aws-github-runner/blob/main/docs/index.md), explaining why the runner-binaries-syncer Lambda exists.
