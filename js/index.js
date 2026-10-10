// Typeset the problem statement and give every video a minimal play/pause + scrub bar.

document.addEventListener("DOMContentLoaded", () => {
    if (window.katex) {
        document.querySelectorAll(".problem .math, .problem .m").forEach(el => {
            katex.render(el.textContent, el, {displayMode: el.classList.contains("math"), throwOnError: false});
        });
        // Scale down only a display formula that would otherwise overflow its column.
        const fit = () => document.querySelectorAll(".problem .math").forEach(el => {
            el.style.fontSize = "";
            const ratio = el.clientWidth / el.scrollWidth;
            if (ratio < 1) el.style.fontSize = (0.9 * ratio * 0.98) + "em";
        });
        fit();
        window.addEventListener("resize", fit);
    }

    const PLAY = '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>';
    const PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';

    document.querySelectorAll("video.result-video").forEach(video => {
        const wrap = document.createElement("div");
        wrap.className = "video-wrap" + (video.classList.contains("square-video") ? " square-video" : "");
        video.classList.remove("square-video");
        video.parentNode.insertBefore(wrap, video);
        wrap.appendChild(video);

        const bar = document.createElement("div");
        bar.className = "video-bar";
        const btn = document.createElement("button");
        btn.type = "button";
        const seek = document.createElement("input");
        seek.type = "range"; seek.min = 0; seek.max = 1000; seek.value = 0;
        seek.setAttribute("aria-label", "Seek");
        bar.append(btn, seek);
        wrap.appendChild(bar);

        const sync = () => {
            btn.innerHTML = video.paused ? PLAY : PAUSE;
            btn.setAttribute("aria-label", video.paused ? "Play" : "Pause");
        };
        const toggle = () => (video.paused ? video.play() : video.pause());
        let scrubbing = false;

        btn.addEventListener("click", toggle);
        video.addEventListener("click", toggle);
        video.addEventListener("play", sync);
        video.addEventListener("pause", sync);
        video.addEventListener("timeupdate", () => {
            if (!scrubbing && video.duration) seek.value = 1000 * video.currentTime / video.duration;
        });
        seek.addEventListener("input", () => {
            scrubbing = true;
            if (video.duration) video.currentTime = seek.value / 1000 * video.duration;
        });
        seek.addEventListener("change", () => { scrubbing = false; });
        sync();
    });

    // Browsers refuse their built-in PDF viewer inside sandboxed frames (e.g. a shared preview),
    // so when framed, show the paper in an in-page PDF.js viewer instead of following the link.
    const paper = document.querySelector('a[href="./paper.pdf"]');
    if (paper && window.self !== window.top) {
        paper.addEventListener("click", e => { e.preventDefault(); openPdf(paper.href); });
    }
});

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
let pdfOverlay = null;

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src; s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
    });
}

async function openPdf(url) {
    if (pdfOverlay) { pdfOverlay.hidden = false; document.body.style.overflow = "hidden"; return; }
    pdfOverlay = document.createElement("div");
    pdfOverlay.className = "pdf-overlay";
    pdfOverlay.innerHTML = '<button type="button" class="pdf-close" aria-label="Close">&times;</button>'
                         + '<div class="pdf-pages"><p class="pdf-status">Loading paper&hellip;</p></div>';
    document.body.appendChild(pdfOverlay);
    document.body.style.overflow = "hidden";
    const close = () => { pdfOverlay.hidden = true; document.body.style.overflow = ""; };
    pdfOverlay.querySelector(".pdf-close").addEventListener("click", close);
    pdfOverlay.addEventListener("click", e => { if (e.target === pdfOverlay) close(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !pdfOverlay.hidden) close(); });

    const pages = pdfOverlay.querySelector(".pdf-pages");
    try {
        if (!window.pdfjsLib) await loadScript(PDFJS + "pdf.min.js");
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
        const doc = await pdfjsLib.getDocument(url).promise;
        pages.innerHTML = "";
        const width = Math.min(900, window.innerWidth - 32);
        for (let n = 1; n <= doc.numPages; n++) {
            const page = await doc.getPage(n);
            const base = page.getViewport({scale: 1});
            const scale = width / base.width * (window.devicePixelRatio || 1) * 1.5;
            const vp = page.getViewport({scale});
            const canvas = document.createElement("canvas");
            canvas.width = vp.width; canvas.height = vp.height;
            canvas.style.width = width + "px";
            pages.appendChild(canvas);
            await page.render({canvasContext: canvas.getContext("2d"), viewport: vp}).promise;
        }
    } catch (err) {
        pages.innerHTML = '<p class="pdf-status">Could not load the paper.</p>';
    }
}
