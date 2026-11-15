/* The handful of behaviours a note needs after it is on screen. Everything
   here degrades to nothing: without JS the copy buttons are inert, figures
   are links, the table of contents is a list and the rail is a line. Runs
   on astro:page-load so it re-attaches after a client-side navigation. */

/* the async clipboard API first; a hidden textarea and execCommand when
   the document is not focused or the API is unavailable */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

function initCopyButtons(root: ParentNode) {
  for (const button of root.querySelectorAll<HTMLButtonElement>(".code-copy")) {
    button.addEventListener("click", async () => {
      const pre = button.closest(".code-block")?.querySelector("pre");
      if (!pre) return;
      const text = pre.innerText.replace(/\n$/, "");
      if (await copyText(text)) {
        button.textContent = "copied";
        button.dataset.state = "done";
      } else {
        button.textContent = "failed";
      }
      window.setTimeout(() => {
        button.textContent = "copy";
        delete button.dataset.state;
      }, 1600);
    });
  }
}

function initLightbox(root: ParentNode) {
  const dialog = root.querySelector<HTMLDialogElement>("dialog.lightbox");
  if (!dialog || typeof dialog.showModal !== "function") return;
  const image = dialog.querySelector("img")!;
  for (const link of root.querySelectorAll<HTMLAnchorElement>("a[data-lightbox]")) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const source = link.querySelector("img");
      image.src = link.href;
      image.alt = source?.alt ?? "";
      dialog.showModal();
    });
  }
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function initTableOfContents(root: ParentNode) {
  const links = [...root.querySelectorAll<HTMLAnchorElement>(".toc a[href^='#']")];
  if (!links.length) return;
  const byId = new Map(links.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
  const headings = [...byId.keys()].map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
  if (!headings.length) return;
  let current: HTMLAnchorElement | null = null;
  const activate = (id: string) => {
    const next = byId.get(id) ?? null;
    if (next === current) return;
    current?.removeAttribute("aria-current");
    next?.setAttribute("aria-current", "location");
    current = next;
  };
  /* the last heading above the top third of the viewport is the one being
     read; computed on scroll, so a jump lands on the right entry too */
  let ticking = false;
  const update = () => {
    ticking = false;
    const line = window.innerHeight * 0.3;
    let best = headings[0];
    for (const h of headings) {
      if (h.getBoundingClientRect().top <= line) best = h;
    }
    activate(best.id);
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
}

function initProgress(root: ParentNode) {
  const fill = root.querySelector<HTMLElement>(".rail-fill");
  const article = root.querySelector<HTMLElement>("article[data-progress]");
  if (!fill || !article) return;
  const update = () => {
    const rect = article.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const done = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
    fill.style.transform = `scaleY(${done})`;
  };
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
}

function init() {
  initCopyButtons(document);
  initLightbox(document);
  initTableOfContents(document);
  initProgress(document);
}

document.addEventListener("astro:page-load", init);
