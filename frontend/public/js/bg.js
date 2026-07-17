(function () {
    'use strict';

    // ── Setup ────────────────────────────────────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.id = 'bg-canvas';
    Object.assign(canvas.style, {
        position: 'fixed', top: '0', left: '0',
        width: '100%', height: '100%',
        zIndex: '-1', pointerEvents: 'none', display: 'block'
    });
    document.body.prepend(canvas);

    const ctx    = canvas.getContext('2d', { alpha: false });
    const COUNT  = 55;       // was 130 — O(n²) pairs: 55→1485 vs 130→8385
    const MAX_D  = 120;      // was 160 — shorter connections = fewer draws
    const MAX_D2 = MAX_D * MAX_D; // compare squared to avoid sqrt when possible

    const ACCENT  = '100,255,218';
    const ACCENT2 = '56,189,248';
    const ACCENT3 = '147,112,219';
    const COLORS  = [ACCENT, ACCENT2, ACCENT3];

    let W, H, particles = [];
    let rafId = null;

    // ── Static hex-grid — drawn ONCE onto an offscreen canvas ───────────────
    let hexCanvas = null;

    function buildHexGrid(w, h) {
        const oc  = document.createElement('canvas');
        oc.width  = w;
        oc.height = h;
        const oc2 = oc.getContext('2d');
        const size = 50;
        const hh   = size * Math.sqrt(3);
        oc2.strokeStyle = 'rgba(100,255,218,0.022)';
        oc2.lineWidth   = 0.5;
        for (let row = -1; row < h / hh + 1; row++) {
            for (let col = -1; col < w / (size * 1.5) + 1; col++) {
                const x = col * size * 3 + (row % 2) * size * 1.5;
                const y = row * hh;
                oc2.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i - Math.PI / 6;
                    const px = x + size * Math.cos(angle);
                    const py = y + size * Math.sin(angle);
                    i === 0 ? oc2.moveTo(px, py) : oc2.lineTo(px, py);
                }
                oc2.closePath();
                oc2.stroke();
            }
        }
        return oc;
    }

    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
        hexCanvas = buildHexGrid(W, H); // rebuild static grid on resize
    }

    // ── Particles ────────────────────────────────────────────────────────────
    function makeParticle() {
        return {
            x:  Math.random() * (W || window.innerWidth),
            y:  Math.random() * (H || window.innerHeight),
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            r:  1.5 + Math.random() * 1.5,
            col: COLORS[Math.floor(Math.random() * COLORS.length)],
            pulse: Math.random() * Math.PI * 2,
            pulseSpeed: 0.01 + Math.random() * 0.02,
            glow: 1
        };
    }

    function init() {
        resize();
        particles = Array.from({ length: COUNT }, makeParticle);
    }

    // ── Draw background (solid fill + cached hex grid + 3 gradient pools) ───
    // Gradients are static relative to viewport — rebuild only on resize
    let gradientPool = null;

    function buildGradients() {
        gradientPool = [
            { x: W * 0.15, y: H * 0.20, r: W * 0.35, c: ACCENT,  a: 0.045 },
            { x: W * 0.85, y: H * 0.75, r: W * 0.30, c: ACCENT2, a: 0.035 },
            { x: W * 0.50, y: H * 0.50, r: W * 0.25, c: ACCENT3, a: 0.025 }
        ].map(p => {
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
            g.addColorStop(0, `rgba(${p.c},${p.a})`);
            g.addColorStop(1, `rgba(${p.c},0)`);
            return g;
        });
    }

    function drawBackground() {
        // Solid base (no clear needed — alpha:false canvas)
        ctx.fillStyle = '#020b14';
        ctx.fillRect(0, 0, W, H);

        // Hex grid from offscreen cache — one drawImage instead of hundreds of strokes
        if (hexCanvas) ctx.drawImage(hexCanvas, 0, 0);

        // Ambient glow pools (pre-built gradient objects)
        if (gradientPool) {
            for (const g of gradientPool) {
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, W, H);
            }
        }
    }

    // ── Main loop ─────────────────────────────────────────────────────────────
    function loop() {
        // Pause entirely when tab is hidden — saves battery & CPU
        if (document.hidden) {
            rafId = requestAnimationFrame(loop);
            return;
        }

        drawBackground();

        // Update + draw particles and connections
        // No shadowBlur — use rgba alpha for the glow effect instead (shadowBlur is
        // the single most expensive canvas operation; removing it gives 3-5× speedup)
        ctx.lineWidth = 0.9;

        for (let i = 0; i < COUNT; i++) {
            const p = particles[i];

            // Move
            p.x += p.vx;
            p.y += p.vy;
            p.pulse += p.pulseSpeed;
            if (p.x < -5)    p.x = W + 5;
            if (p.x > W + 5) p.x = -5;
            if (p.y < -5)    p.y = H + 5;
            if (p.y > H + 5) p.y = -5;

            // Pulse glow via opacity — no shadowBlur needed
            p.glow = 0.55 + 0.45 * Math.sin(p.pulse);

            // Draw connections to later particles (avoid duplicate pairs)
            for (let j = i + 1; j < COUNT; j++) {
                const q  = particles[j];
                const dx = p.x - q.x;
                const dy = p.y - q.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < MAX_D2) {
                    // Use squared distance directly to avoid expensive Math.sqrt
                    const alpha = (1 - Math.sqrt(d2) / MAX_D) * 0.5;
                    if (alpha > 0.02) { // skip near-invisible lines
                        ctx.strokeStyle = `rgba(${p.col},${alpha})`;
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(q.x, q.y);
                        ctx.stroke();
                    }
                }
            }

            // Draw particle dot
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.col},${p.glow})`;
            ctx.fill();
        }

        rafId = requestAnimationFrame(loop);
    }

    // ── Init ─────────────────────────────────────────────────────────────────
    window.addEventListener('resize', () => {
        resize();
        buildGradients();
    });

    init();
    buildGradients();
    loop();
})();
