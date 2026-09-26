// One time welcome to version 4 for users who update from 3.x, and a short tour of the floating toolbar that
// replaced the buttons in the page header. Plain DOM and CSS, no jQuery or Fomantic.

const CELEBRATION_STORAGE_KEY = "cpiHelper_v4Celebrated";
const CELEBRATION_CONTRIBUTORS_URL = "https://github.com/dbeck121/CPI-Helper-Chrome-Extension/graphs/contributors";
const CELEBRATION_SPONSOR_URL = "https://figaf.com/cpihelper-and-figaf";
const CELEBRATION_COLORS = ["#0a6ed1", "#e9730c", "#107e3e", "#d04343", "#945ecf", "#f0ab00"];

// only an update from 3.x to 4.x: new users never saw the old header buttons
function isV4Upgrade(lastVersion, currentVersion) {
  return parseInt(lastVersion, 10) === 3 && parseInt(currentVersion, 10) === 4;
}

function celebrationReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

// falling pieces for the welcome, or a burst from a point (x, y) at the end of the tour
function createConfetti({ count, burstFrom } = {}) {
  const layer = document.createElement("div");
  layer.className = "cpiHelper_confetti";
  layer.setAttribute("aria-hidden", "true");
  if (celebrationReducedMotion()) return layer;

  for (let index = 0; index < count; index++) {
    const piece = document.createElement("span");
    piece.style.background = CELEBRATION_COLORS[index % CELEBRATION_COLORS.length];
    piece.style.animationDelay = `${Math.random() * 0.6}s`;
    if (burstFrom) {
      const angle = (index / count) * 2 * Math.PI;
      const distance = 60 + Math.random() * 90;
      piece.className = "cpiHelper_confetti_burst";
      piece.style.left = `${burstFrom.x}px`;
      piece.style.top = `${burstFrom.y}px`;
      piece.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
      piece.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    } else {
      piece.className = "cpiHelper_confetti_fall";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.setProperty("--drift", `${(Math.random() - 0.5) * 120}px`);
      piece.style.setProperty("--spin", `${360 + Math.random() * 720}deg`);
      piece.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
    }
    layer.appendChild(piece);
  }
  return layer;
}

function showV4Celebration() {
  document.getElementById("cpiHelper_celebration")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "cpiHelper_celebration";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "cpiHelper_celebration_title");

  const card = document.createElement("div");
  card.className = "cpiHelper_celebration_card";
  card.innerHTML = `
    <button type="button" class="cpiHelper_celebration_close" aria-label="Close">${floatingToolbarIcon("close")}</button>
    <div class="cpiHelper_celebration_badge">4.0</div>
    <h2 id="cpiHelper_celebration_title">CPI Helper 4.0</h2>
    <p class="cpiHelper_celebration_lead">The biggest update since version 3.</p>
    <p>Your buttons moved into a toolbar you can place anywhere on the page, and your plugins came along.</p>
    <p class="cpiHelper_celebration_thanks">Built with the community. Thank you to
      <a href="${CELEBRATION_CONTRIBUTORS_URL}" target="_blank" rel="noreferrer">everyone who contributed</a>.</p>
    <a class="cpiHelper_celebration_sponsor" href="${CELEBRATION_SPONSOR_URL}" target="_blank" rel="noreferrer">
      <img src="${chrome.runtime.getURL("images/figaf_logo.png")}" alt="Figaf">
      <span>This release is sponsored by Figaf</span>
    </a>
    <div class="cpiHelper_celebration_actions">
      <button type="button" class="cpiHelper_celebration_primary">Show me the new toolbar</button>
      <button type="button" class="cpiHelper_celebration_secondary">What changed</button>
    </div>`;

  overlay.append(createConfetti({ count: 60 }), card);
  document.body.appendChild(overlay);

  const close = () => {
    document.removeEventListener("keydown", onKeydown, true);
    overlay.remove();
  };
  const onKeydown = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    }
  };
  document.addEventListener("keydown", onKeydown, true);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  card.querySelector(".cpiHelper_celebration_close").addEventListener("click", close);
  card.querySelector(".cpiHelper_celebration_primary").addEventListener("click", () => {
    close();
    startToolbarTour();
  });
  card.querySelector(".cpiHelper_celebration_secondary").addEventListener("click", () => {
    close();
    whatsNewCheck(false, "changes");
  });
  card.querySelector(".cpiHelper_celebration_primary").focus();
  return overlay;
}

// ----------------------------------------------------------------------------------------- tour

// elements are looked up on every step: the heartbeat may rebuild the toolbar while the tour runs
function toolbarTourParts() {
  const toolbar = getFloatingToolbar();
  const buttons = [...(toolbar?.querySelectorAll(".cpiHelper_floatingToolbar_button") || [])];
  const separator = toolbar?.querySelector(".cpiHelper_floatingToolbar_separator");
  const before = (element) => !separator || element.compareDocumentPosition(separator) & Node.DOCUMENT_POSITION_FOLLOWING;
  return {
    core: buttons.filter((button) => !button.classList.contains("cpiHelper_floatingToolbar_toggle") && before(button)),
    grip: [toolbar?.querySelector(".cpiHelper_floatingToolbar_grip")].filter(Boolean),
    // the plugin section and the variant switch below it
    plugins: [separator, ...buttons.filter((button) => !before(button) || button.classList.contains("cpiHelper_floatingToolbar_toggle"))].filter(Boolean),
  };
}

const TOOLBAR_TOUR_STEPS = [
  {
    part: "core",
    title: "Your buttons live here now",
    text: "Trace, Messages, Info, Logs and Runtime moved from the page header into this toolbar.",
  },
  {
    part: "grip",
    title: "Drag me by the header",
    text: "Put the toolbar wherever it bothers you least, it remembers the place. The header has the color of your tenant.",
    pulse: true,
  },
  {
    part: "plugins",
    title: "Plugins and the compact view",
    text: "Your active plugins have their own section. The switch at the bottom toggles between labels and icons only.",
  },
];

function unionRect(elements) {
  const rects = elements.filter((element) => element.isConnected).map((element) => element.getBoundingClientRect());
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

// the toolbar is built by the heartbeat, so it may not exist yet right after the welcome
async function waitForFloatingToolbar(timeout = 8000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const toolbar = getFloatingToolbar();
    if (toolbar?.querySelector(".cpiHelper_floatingToolbar_separator")) return toolbar;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return getFloatingToolbar();
}

async function startToolbarTour() {
  document.getElementById("cpiHelper_tour")?._cpiHelperEnd?.();
  const toolbar = await waitForFloatingToolbar();
  if (!toolbar) {
    showToast("Open an integration flow, the toolbar and its tour live there.", "CPI Helper 4.0", "info");
    return null;
  }

  const steps = TOOLBAR_TOUR_STEPS;
  let current = 0;

  const tour = document.createElement("div");
  tour.id = "cpiHelper_tour";
  // blocks the page while the tour runs, the spotlight cuts the hole
  const spotlight = document.createElement("div");
  spotlight.className = "cpiHelper_tour_spotlight";
  const card = document.createElement("div");
  card.className = "cpiHelper_tour_card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-live", "polite");
  card.innerHTML = `
    <div class="cpiHelper_tour_step"></div>
    <h3 class="cpiHelper_tour_title"></h3>
    <p class="cpiHelper_tour_text"></p>
    <div class="cpiHelper_tour_actions">
      <button type="button" class="cpiHelper_tour_skip">Skip tour</button>
      <span class="cpiHelper_tour_spacer"></span>
      <button type="button" class="cpiHelper_tour_back">Back</button>
      <button type="button" class="cpiHelper_tour_next">Next</button>
    </div>`;
  tour.append(spotlight, card);
  document.body.appendChild(tour);

  const render = () => {
    const step = steps[current];
    const rect = unionRect(toolbarTourParts()[step.part]);
    if (!rect) {
      end(false);
      return;
    }
    const pad = 6;
    Object.assign(spotlight.style, { left: `${rect.left - pad}px`, top: `${rect.top - pad}px`, width: `${rect.width + 2 * pad}px`, height: `${rect.height + 2 * pad}px` });
    spotlight.classList.toggle("cpiHelper_tour_pulse", !!step.pulse && !celebrationReducedMotion());

    card.querySelector(".cpiHelper_tour_step").textContent = `${current + 1} of ${steps.length}`;
    card.querySelector(".cpiHelper_tour_title").textContent = step.title;
    card.querySelector(".cpiHelper_tour_text").textContent = step.text;
    card.setAttribute("aria-label", step.title);
    card.querySelector(".cpiHelper_tour_back").hidden = current === 0;
    card.querySelector(".cpiHelper_tour_next").textContent = current === steps.length - 1 ? "Done" : "Next";

    // beside the target, towards the middle of the screen, inside the viewport
    const gap = 18;
    const openLeft = rect.left + rect.width / 2 > window.innerWidth / 2;
    const width = card.offsetWidth;
    const left = openLeft ? rect.left - pad - gap - width : rect.right + pad + gap;
    card.style.left = `${Math.min(Math.max(left, 8), window.innerWidth - width - 8)}px`;
    card.style.top = `${Math.min(Math.max(rect.top - pad, 8), window.innerHeight - card.offsetHeight - 8)}px`;
    card.classList.toggle("cpiHelper_tour_card_left", openLeft);
    card.querySelector(".cpiHelper_tour_next").focus();
  };

  const onKeydown = (event) => {
    if (event.key === "Escape") end(false);
    else if (event.key === "ArrowRight") go(1);
    else if (event.key === "ArrowLeft") go(-1);
    else return;
    event.preventDefault();
    event.stopPropagation();
  };
  const onResize = () => render();

  const go = (delta) => {
    const next = current + delta;
    if (next < 0) return;
    if (next >= steps.length) {
      end(true);
      return;
    }
    current = next;
    render();
  };

  const end = (finished) => {
    document.removeEventListener("keydown", onKeydown, true);
    window.removeEventListener("resize", onResize);
    tour.remove();
    if (finished) {
      const grip = getFloatingToolbar()?.querySelector(".cpiHelper_floatingToolbar_grip")?.getBoundingClientRect();
      if (grip) {
        const burst = createConfetti({ count: 28, burstFrom: { x: grip.left + grip.width / 2, y: grip.top + grip.height / 2 } });
        document.body.appendChild(burst);
        setTimeout(() => burst.remove(), 1600);
      }
    }
  };
  tour._cpiHelperEnd = () => end(false);

  card.querySelector(".cpiHelper_tour_next").addEventListener("click", () => go(1));
  card.querySelector(".cpiHelper_tour_back").addEventListener("click", () => go(-1));
  card.querySelector(".cpiHelper_tour_skip").addEventListener("click", () => end(false));
  document.addEventListener("keydown", onKeydown, true);
  window.addEventListener("resize", onResize);
  render();
  return tour;
}
