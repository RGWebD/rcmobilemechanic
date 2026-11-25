(() => {
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  root.classList.add("js");
  if (!reduce) root.classList.add("rv");

  /* Intro: tachometer sweep, once per session */
  const intro = document.querySelector(".intro");
  if (intro) {
    let seen = false;
    try { seen = sessionStorage.getItem("rc-intro") === "1"; } catch (e) {}
    if (reduce || seen) { intro.remove(); }
    else {
      root.classList.add("intro-on");
      try { sessionStorage.setItem("rc-intro", "1"); } catch (e) {}
      const end = () => { intro.classList.add("done"); setTimeout(() => intro.remove(), 1100); };
      setTimeout(end, 2100);
      intro.addEventListener("click", end);
    }
  }

  /* Split text */
  document.querySelectorAll("[data-split]").forEach((el) => {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span"); w.className = "w";
            const s = document.createElement("span"); s.textContent = part; s.style.setProperty("--i", i++);
            w.appendChild(s); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
      });
    };
    if (!reduce) { el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim()); walk(el); el.classList.add("split");
      el.querySelectorAll(".w").forEach((w) => w.setAttribute("aria-hidden", "true")); }
  });

  /* Reveal observer */
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }) : null;
  const revealables = document.querySelectorAll(".reveal,.reveal-x,.clip,.split,.gauge,[data-count]");
  document.querySelectorAll(".reveal").forEach((el) => {
    const sibs = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
    const i = sibs.indexOf(el); if (i > 0) el.style.setProperty("--d", Math.min(i * 0.08, 0.6).toFixed(2) + "s");
  });
  const introDelay = root.classList.contains("intro-on") ? 1900 : 0;
  setTimeout(() => {
    revealables.forEach((el) => { if (io && !reduce) io.observe(el); else el.classList.add("in"); });
  }, introDelay);

  /* Counters */
  const counted = new WeakSet();
  const runCounter = (el) => {
    if (counted.has(el)) return; counted.add(el);
    const t = parseFloat(el.dataset.count), d = parseInt(el.dataset.decimals || "0", 10);
    if (reduce) { el.textContent = t.toFixed(d); return; }
    const t0 = performance.now(), dur = 1800;
    const step = (now) => { const p = Math.min(1, (now - t0) / dur); const e = 1 - Math.pow(1 - p, 4);
      el.textContent = (t * e).toFixed(d); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  const cio = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { runCounter(e.target); cio.unobserve(e.target); } }), { threshold: 0.4 }) : null;
  setTimeout(() => document.querySelectorAll("[data-count]").forEach((el) => cio ? cio.observe(el) : runCounter(el)), introDelay);

  /* Gauge arc lengths */
  document.querySelectorAll(".gauge .g-val").forEach((p) => { try { p.closest(".gauge").style.setProperty("--len", p.getTotalLength().toFixed(1)); } catch (e) {} });

  /* Scroll: nav, progress, parallax, route */
  const nav = document.querySelector(".nav");
  const bar = document.querySelector(".progress span");
  const par = [...document.querySelectorAll("[data-parallax]")];
  const route = document.querySelector("[data-route]");
  let path, drawn, van, len = 0;
  const setupRoute = () => {
    if (!route) return;
    const svg = route.querySelector(".route-svg"); const steps = route.querySelectorAll(".step");
    if (!svg || !steps.length || getComputedStyle(svg).display === "none") return;
    const rb = route.getBoundingClientRect(); svg.setAttribute("viewBox", `0 0 ${rb.width} ${rb.height}`);
    const pts = [...steps].map((s, i) => { const r = s.getBoundingClientRect();
      const wide = rb.width > 900; const x = wide ? rb.width * (i % 2 === 0 ? 0.66 : 0.34) : (i % 2 === 0 ? r.right - rb.left + 70 : r.left - rb.left - 70); return [Math.max(30, Math.min(rb.width - 30, x)), r.top - rb.top + r.height / 2]; });
    let d = `M ${rb.width / 2} 0 C ${rb.width / 2} 60, ${pts[0][0]} ${pts[0][1] - 120}, ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const my = (y0 + y1) / 2;
      d += ` C ${x0} ${my}, ${x1} ${my}, ${x1} ${y1}`; }
    const last = pts[pts.length - 1]; d += ` C ${last[0]} ${last[1] + 120}, ${rb.width / 2} ${rb.height - 60}, ${rb.width / 2} ${rb.height}`;
    svg.querySelectorAll("path").forEach((p) => p.setAttribute("d", d));
    path = svg.querySelector(".drawn"); van = route.querySelector(".van");
    len = path.getTotalLength(); path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
  };
  const onScroll = () => {
    const y = scrollY, h = root.scrollHeight - innerHeight;
    if (nav) nav.classList.toggle("scrolled", y > 30);
    if (bar) bar.style.setProperty("--p", h > 0 ? (y / h).toFixed(4) : 0);
    if (reduce) { if (path) { path.style.strokeDashoffset = 0; } return; }
    par.forEach((el) => { const r = el.getBoundingClientRect(); if (r.bottom < -200 || r.top > innerHeight + 200) return;
      const k = parseFloat(el.dataset.parallax || "0.12"); const c = (r.top + r.height / 2 - innerHeight / 2);
      el.style.setProperty("--py", (c * -k).toFixed(1) + "px"); });
    if (path && len) {
      const r = route.getBoundingClientRect(); let p = (innerHeight * 0.6 - r.top) / r.height; p = Math.max(0, Math.min(1, p));
      path.style.strokeDashoffset = (len * (1 - p)).toFixed(1);
      if (van) { const L = Math.max(0.5, len * p); const pt = path.getPointAtLength(L), pt2 = path.getPointAtLength(Math.max(0, L - 4));
        let ang = Math.atan2(pt.y - pt2.y, pt.x - pt2.x) * 180 / Math.PI; const flip = Math.abs(ang) > 90;
        van.style.transform = `translate(${pt.x}px,${pt.y}px) rotate(${flip ? ang + 180 : ang}deg) scaleX(${flip ? -1 : 1})`;
        van.style.opacity = p > 0 && p < 1 ? 1 : (p === 0 ? .6 : 1); }
    }
  };
  let tick = false;
  addEventListener("scroll", () => { if (!tick) { tick = true; requestAnimationFrame(() => { onScroll(); tick = false; }); } }, { passive: true });
  addEventListener("resize", () => { setupRoute(); onScroll(); });
  addEventListener("load", () => { setupRoute(); onScroll(); });
  setupRoute(); onScroll();
  if (reduce && path) path.style.strokeDashoffset = 0;

  /* Mobile menu */
  const toggle = document.querySelector(".menu-toggle");
  if (toggle && nav) {
    const set = (open) => { toggle.setAttribute("aria-expanded", open); nav.classList.toggle("open", open); document.body.style.overflow = open ? "hidden" : ""; };
    toggle.addEventListener("click", () => set(toggle.getAttribute("aria-expanded") !== "true"));
    document.querySelectorAll(".menu a").forEach((a) => a.addEventListener("click", () => set(false)));
    addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("open")) { set(false); toggle.focus(); } });
  }

  /* Magnetic buttons */
  if (fine && !reduce) document.querySelectorAll(".magnetic").forEach((b) => {
    b.addEventListener("pointermove", (e) => { const r = b.getBoundingClientRect();
      b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px,${(e.clientY - r.top - r.height / 2) * 0.35}px)`; });
    b.addEventListener("pointerleave", () => { b.style.transform = ""; });
  });

  /* Service card spotlight */
  if (fine) document.querySelectorAll(".svc").forEach((c) => c.addEventListener("pointermove", (e) => {
    const r = c.getBoundingClientRect(); c.style.setProperty("--mx", e.clientX - r.left + "px"); c.style.setProperty("--my", e.clientY - r.top + "px"); }));

  /* Draggable rails */
  document.querySelectorAll("[data-drag]").forEach((rail) => {
    let down = false, sx = 0, sl = 0, moved = 0, v = 0, lx = 0, raf;
    rail.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") return; down = true; moved = 0; sx = lx = e.clientX; sl = rail.scrollLeft; cancelAnimationFrame(raf); });
    addEventListener("pointermove", (e) => { if (!down) return; const dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx));
      if (moved > 5) rail.classList.add("dragging"); v = e.clientX - lx; lx = e.clientX; rail.scrollLeft = sl - dx; });
    addEventListener("pointerup", () => { if (!down) return; down = false;
      setTimeout(() => rail.classList.remove("dragging"), 0);
      if (!reduce) { const glide = () => { v *= 0.93; rail.scrollLeft -= v; if (Math.abs(v) > 0.5) raf = requestAnimationFrame(glide); }; glide(); } });
    const ctrl = document.querySelector(`[data-rail-ctrl="${rail.id}"]`);
    if (ctrl) { ctrl.querySelector(".prev").addEventListener("click", () => rail.scrollBy({ left: -rail.clientWidth * 0.7, behavior: reduce ? "auto" : "smooth" }));
      ctrl.querySelector(".next").addEventListener("click", () => rail.scrollBy({ left: rail.clientWidth * 0.7, behavior: reduce ? "auto" : "smooth" })); }
  });

  /* Lightbox */
  const lb = document.querySelector(".lightbox");
  if (lb) {
    const img = lb.querySelector("img"), cap = lb.querySelector(".cap");
    let group = [], idx = 0, last;
    const show = (i) => { idx = (i + group.length) % group.length; const b = group[idx];
      img.src = b.dataset.full; img.alt = b.dataset.alt || ""; cap.textContent = `${String(idx + 1).padStart(2, "0")} / ${String(group.length).padStart(2, "0")} — ${b.dataset.cap || ""}`; };
    const open = (b) => { last = b; group = [...document.querySelectorAll(`[data-lb="${b.dataset.lb}"]`)]; show(group.indexOf(b));
      lb.classList.add("open"); lb.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; lb.querySelector(".lb-close").focus(); };
    const close = () => { lb.classList.remove("open"); lb.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; if (last) last.focus(); };
    document.querySelectorAll("[data-lb]").forEach((b) => b.addEventListener("click", (e) => { if (b.closest(".rail.dragging")) { e.preventDefault(); return; } open(b); }));
    lb.querySelector(".lb-close").addEventListener("click", close);
    lb.querySelector(".lb-prev").addEventListener("click", () => show(idx - 1));
    lb.querySelector(".lb-next").addEventListener("click", () => show(idx + 1));
    lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
    addEventListener("keydown", (e) => { if (!lb.classList.contains("open")) return;
      if (e.key === "Escape") close(); if (e.key === "ArrowLeft") show(idx - 1); if (e.key === "ArrowRight") show(idx + 1); });
    let tx = 0; lb.addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", (e) => { const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1)); });
  }

  /* Review carousel */
  document.querySelectorAll("[data-carousel]").forEach((c) => {
    const track = c.querySelector(".car-track"), cards = [...track.children], dots = c.querySelector(".car-dots");
    if (dots) cards.forEach(() => dots.appendChild(document.createElement("i")));
    const cur = () => { let best = 0, bd = 1e9; cards.forEach((k, i) => { const d = Math.abs(k.offsetLeft - track.offsetLeft - track.scrollLeft); if (d < bd) { bd = d; best = i; } }); return best; };
    const mark = () => { if (dots) [...dots.children].forEach((d, i) => d.classList.toggle("on", i === cur())); };
    const go = (i) => { const k = cards[(i + cards.length) % cards.length]; track.scrollTo({ left: k.offsetLeft - track.offsetLeft, behavior: reduce ? "auto" : "smooth" }); };
    c.querySelector(".prev")?.addEventListener("click", () => go(cur() - 1));
    c.querySelector(".next")?.addEventListener("click", () => go(cur() + 1 >= cards.length ? 0 : cur() + 1));
    track.addEventListener("scroll", () => requestAnimationFrame(mark), { passive: true }); mark();
    if (!reduce) { let t = setInterval(() => go(cur() + 1 >= cards.length ? 0 : cur() + 1), 6500);
      const stop = () => clearInterval(t); ["pointerdown", "focusin", "mouseenter", "touchstart"].forEach((ev) => c.addEventListener(ev, stop, { passive: true })); }
  });

  /* Preview pill */
  const pill = document.querySelector(".preview-pill");
  if (pill) { try { if (localStorage.getItem("rc-pill") === "x") pill.classList.add("gone"); } catch (e) {}
    pill.querySelector("button").addEventListener("click", () => { pill.classList.add("gone"); try { localStorage.setItem("rc-pill", "x"); } catch (e) {} }); }

  /* Service request form -> prefilled text message (nothing is sent automatically) */
  const form = document.querySelector("#request-form");
  if (form) {
    const PHONE = "+19047501894";
    const build = () => { const f = new FormData(form); const g = (k) => (f.get(k) || "").toString().trim();
      const veh = [g("year"), g("make"), g("model")].filter(Boolean).join(" ");
      const lines = ["Hi RC Mobile Mechanic, I'd like to request service.",
        g("name") && `Name: ${g("name")}`, g("phone") && `Callback: ${g("phone")}`, veh && `Vehicle: ${veh}`,
        g("service") && `Service: ${g("service")}`, g("issue") && `Issue: ${g("issue")}`, g("location") && `Location: ${g("location")}`,
        g("when") && `Preferred time: ${g("when")}${g("datetime") ? " (" + g("datetime").replace("T", " ") + ")" : ""}`];
      return lines.filter(Boolean).join("\n"); };
    const err = form.querySelector(".err");
    const valid = () => { const miss = [...form.querySelectorAll("[required]")].filter((i) => !i.value.trim());
      if (miss.length) { err.textContent = "Please fill in: " + miss.map((i) => form.querySelector(`label[for="${i.id}"]`)?.textContent.replace("*", "").trim()).join(", ") + "."; miss[0].focus(); return false; }
      err.textContent = ""; return true; };
    form.addEventListener("submit", (e) => { e.preventDefault(); if (!valid()) return;
      location.href = `sms:${PHONE}?&body=${encodeURIComponent(build())}`; });
    form.querySelector("[data-copy]")?.addEventListener("click", async () => { if (!valid()) return;
      try { await navigator.clipboard.writeText(build()); err.textContent = "Details copied — paste them when you call or text (904) 750-1894."; } catch (e) { err.textContent = build(); } });
    const when = form.querySelector("#when"), dt = form.querySelector("#dt-field");
    if (when && dt) { const sync = () => { dt.hidden = when.value !== "Schedule a specific time"; }; when.addEventListener("change", sync); sync(); }
  }

  /* Year in footer */
  document.querySelectorAll("[data-year]").forEach((e) => e.textContent = new Date().getFullYear());
})();
