import { Stage } from '@/stageshow/kit/stage'
import { Window, Bar, Caret, Prompt } from '@/stageshow/kit/window'
import { Code, type CodeLine } from '@/stageshow/kit/code'
import { Count } from '@/stageshow/kit/motion/Count'
import { Badge } from '@/stageshow/kit/controls/Badge'
import { Meter } from '@/stageshow/kit/parts/Meter'
import { Spinner } from '@/stageshow/kit/parts/Spinner'
import type { Act } from '@/stageshow/kit/act'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import './infra.css'

// The hero: one repo, three things shipped from it as code. Built from the
// dark-hero and hero-demo golds: an editor inset top and left, off the right
// and fading at its foot, with a terminal satellite straddling its sidebar.
//
// Three scenes, one per file tab, each the same shape: lines are added to the
// file, the command is typed in the terminal, its progress bar fills, the
// result prints and the status pill in the tab bar turns on itself.
//   main.tf      a module added, `terraform apply`, Apply complete
//   deploy.yaml  replicas and an image, `kubectl apply`, 3/3 pods Running
//   ci.yml       a scan job, `git push`, Trivy and Gitleaks passing
// Between scenes the terminal clears and the next tab comes forward; the
// file that leaves fades out whole and is reset while it is hidden.
//
// Real strings: the files, their lines, the commands and their results. The
// file tree is the only filler.

const BASE = 5

type Scene = { file: string; code: CodeLine[]; cmd: string; first: ReactNode; bar: string; total: number; done: ReactNode; pill: [string, string] }

const add = (text: string): CodeLine => ({ text, kind: 'add' })

const SCENES: Scene[] = [
  {
    file: 'main.tf',
    code: ['module "vpc" {', '  source = "./modules/vpc"', '  cidr   = "10.0.0.0/16"', '}', '', add('module "eks" {'), add('  source  = "./modules/eks"'), add('  version = "1.31"'), add('  vpc_id  = module.vpc.vpc_id'), add('}')].map((l) => (typeof l === 'string' ? { text: l } : l)),
    cmd: 'terraform apply',
    first: <><span className="dim">Plan:</span> 3 to add<span className="dim">, 0 to change</span></>,
    bar: 'Applying',
    total: 3,
    done: <><span className="ok">✓</span> Apply complete <span className="dim">in 1m 52s</span></>,
    pill: ['Planning', 'Applied'],
  },
  {
    file: 'deploy.yaml',
    code: ['apiVersion: apps/v1', 'kind: Deployment', 'metadata:', '  name: api', 'spec:', add('  replicas: 3'), add('  template:'), add('    spec:'), add('      containers:'), add('        - image: api:1.4.2')].map((l) => (typeof l === 'string' ? { text: l } : l)),
    cmd: 'kubectl apply -f k8s/',
    first: <>deployment.apps/api <span className="dim">configured</span></>,
    bar: 'Rolling',
    total: 3,
    done: <><span className="ok">✓</span> 3/3 pods Running</>,
    pill: ['Rolling out', '3/3 Ready'],
  },
  {
    file: 'ci.yml',
    code: ['name: deliver', 'on: push', 'jobs:', '  build:', '    runs-on: ubuntu-latest', add('  scan:'), add('    needs: build'), add('    steps:'), add('      - run: trivy image api'), add('      - run: gitleaks detect')].map((l) => (typeof l === 'string' ? { text: l } : l)),
    cmd: 'git push origin main',
    first: <><span className="dim">CI:</span> deliver <span className="dim">queued</span></>,
    bar: 'Scanning',
    total: 2,
    done: <><span className="ok">✓</span> 0 critical<span className="dim">,</span> no leaks</>,
    pill: ['CI running', 'CI passed'],
  },
]

type S = { scene: number; lines: number; cmd: string; ran: boolean; done: boolean; clear: boolean }

const initial: S = { scene: 0, lines: BASE, cmd: '', ran: false, done: false, clear: false }
const poster: S = { scene: 0, lines: 10, cmd: 'terraform apply', ran: true, done: true, clear: false }

async function script(a: Act<S>) {
  for (let i = 0; i < SCENES.length; i++) {
    const sc = SCENES[i]!
    a.mark(sc.file)
    await a.wait(i === 0 ? 500 : 350)
    for (let n = BASE + 1; n <= sc.code.length; n++) {
      a.put({ lines: n })
      await a.wait(140)
    }
    await a.wait(350)
    if (a.layout === 'wide') {
      await a.type('cmd', sc.cmd, { interval: 40 })
      await a.wait(220)
    }
    a.put({ ran: true })
    await a.wait(1400)
    a.put({ done: true })
    await a.wait(i === SCENES.length - 1 ? 2000 : 1300)
    // The terminal clears as the next file comes forward
    a.put({ clear: true })
    await a.wait(420)
    // The terminal's text resets while it is faded; the pill eases on to the
    // next file's pending word in the same move as the tab
    await a.snap({ cmd: '', ran: false, clear: false })
    await a.set({ scene: (i + 1) % SCENES.length, lines: BASE, done: false })
  }
}

export default function InfraHero() {
  return (
    <Stage<S>
      width={760}
      height={440}
      compact={{ below: 560, width: 366, height: 330 }}
      theme="dark"
      initial={initial}
      poster={poster}
      script={script}
      className="tf look-da"
    >
      {(s, _rect, layout) => {
        const sc = SCENES[s.scene]!
        const pills = SCENES.flatMap((x) => x.pill)
        return (
          <>
            <Window title="infra" className="tf-win" sidebarWidth={150} sidebar={layout === 'compact' ? undefined : <Files active={s.scene} />}>
              <div className="tf-body">
                <div className="tf-tabs">
                  <span className="tf-tablist">
                    {SCENES.map((x, i) => (
                      <span key={x.file} className="tf-tab" data-on={i === s.scene || undefined}>{x.file}</span>
                    ))}
                  </span>
                  <Badge tone={s.done ? 'success' : 'neutral'} className="tf-badge" icon={<Mark done={s.done} />}>
                    <Label words={pills} on={s.scene * 2 + (s.done ? 1 : 0)} />
                  </Badge>
                </div>
                {/* The three files share one cell and crossfade; the one that
                    leaves fades out whole, so its added lines never vanish in view */}
                <div className="tf-files">
                  {SCENES.map((x, i) => (
                    <div key={x.file} className="tf-pane" data-on={i === s.scene || undefined}>
                      <Code lines={x.code} count={i === s.scene ? s.lines : x.code.length} className="tf-code" />
                    </div>
                  ))}
                </div>
              </div>
            </Window>

            {layout === 'wide' && (
              <Window chrome="terminal" lights="grey" title="infra — zsh" className="tf-term">
                <div className="ss-term tf-term__body" data-clear={s.clear || undefined}>
                  <Prompt path="~/infra">
                    <span className="tf-fade">{s.cmd}</span>
                    {!s.ran && <Caret still={s.cmd.length > 0} />}
                  </Prompt>
                  <div className="tf-out tf-fade" data-on={s.ran || undefined}>{sc.first}</div>
                  <div className="tf-out tf-fade tf-apply" data-on={s.ran || undefined}>
                    <span className="dim tf-bar">{sc.bar}</span>
                    <Meter className="tf-meter" value={s.ran ? 1 : 0} />
                    <span className="tf-count">
                      <Count value={s.ran ? sc.total : 0} duration={1100} />
                      <span className="dim">/{sc.total}</span>
                    </span>
                  </div>
                  <div className="tf-out tf-fade" data-on={(s.done && s.ran) || undefined}>{sc.done}</div>
                </div>
              </Window>
            )}
          </>
        )
      }}
    </Stage>
  )
}

// Spinner and dot share one 8px cell and crossfade, so the word never moves
function Mark({ done }: { done: boolean }) {
  return (
    <span className="tf-mark" data-done={done || undefined}>
      <Spinner size={8} />
      <i className="tf-dot" />
    </span>
  )
}

// The pill keeps its left edge; only its right edge eases to the word showing
function Label({ words, on }: { words: string[]; on: number }) {
  const refs = useRef<HTMLSpanElement[]>([])
  const [w, setW] = useState<number[]>([])
  useLayoutEffect(() => setW(refs.current.map((e) => e.offsetWidth)), [])
  return (
    <span className="tf-label" style={w.length ? { width: w[on] } : undefined}>
      {words.map((t, i) => (
        <span key={t} ref={(e) => { if (e) refs.current[i] = e }} className="tf-word" data-on={i === on || undefined}>{t}</span>
      ))}
    </span>
  )
}

// The file tree: the three real files above the terminal, the active one lit, filler below
function Files({ active }: { active: number }) {
  const rows: (number | string)[] = [...SCENES.map((x) => x.file), 64, 52]
  return (
    <nav className="tf-side">
      {rows.map((r, i) =>
        typeof r === 'string' ? (
          <span key={i} className="tf-file" data-active={SCENES[active]!.file === r || undefined}>
            <Bar w={12} h={12} r={3} tone={SCENES[active]!.file === r ? 4 : 2} />
            {r}
          </span>
        ) : (
          <span key={i} className="tf-file">
            <Bar w={12} h={12} r={3} tone={2} />
            <Bar w={r} h={6} tone={2} />
          </span>
        ),
      )}
    </nav>
  )
}
