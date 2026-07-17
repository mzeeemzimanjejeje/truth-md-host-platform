(function () {
    const canvas = document.createElement('canvas');
    canvas.id = 'bg-canvas';
    Object.assign(canvas.style, {
        position: 'fixed', top: '0', left: '0',
        width: '100%', height: '100%',
        zIndex: '-1', pointerEvents: 'none',
        display: 'block'
    });
    document.body.prepend(canvas);

    const ctx = canvas.getContext('2d');
    const COUNT    = 130;
    const MAX_DIST = 160;
    const ACCENT   = '100,255,218';
    const ACCENT2  = '56,189,248';
    const ACCENT3  = '147,112,219';

    let W, H, particles = [];

    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }

    function rand(a, b) { return Math.random() * (b - a) + a; }

    function Particle() {
        const colors = [ACCENT, ACCENT2, ACCENT3];
        this.reset = function () {
            this.x   = rand(0, W);
            this.y   = rand(0, H);
            this.vx  = rand(-0.5, 0.5);
            this.vy  = rand(-0.5, 0.5);
            this.r   = rand(1.5, 3);
            this.col = colors[Math.floor(Math.random() * colors.length)];
            this.pulse = rand(0, Math.PI * 2);
            this.pulseSpeed = rand(0.01, 0.03);
        };
        this.reset();
        this.update = function () {
            this.x += this.vx;
            this.y += this.vy;
            this.pulse += this.pulseSpeed;
            if (this.x < -5)  this.x = W + 5;
            if (this.x > W+5) this.x = -5;
            if (this.y < -5)  this.y = H + 5;
            if (this.y > H+5) this.y = -5;
        };
        this.draw = function () {
            const glow = 0.6 + 0.4 * Math.sin(this.pulse);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${this.col},${glow})`;
            ctx.shadowColor = `rgba(${this.col},0.9)`;
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
        };
    }

    function init() {
        resize();
        particles = [];
        for (let i = 0; i < COUNT; i++) {
            const p = new Particle();
            particles.push(p);
        }
    }

    function drawBackground() {
        ctx.fillStyle = '#020b14';
        ctx.fillRect(0, 0, W, H);

        // subtle hex grid
        const size = 50;
        const h    = size * Math.sqrt(3);
        ctx.strokeStyle = 'rgba(100,255,218,0.022)';
        ctx.lineWidth = 0.5;
        for (let row = -1; row < H / h + 1; row++) {
            for (let col = -1; col < W / (size * 1.5) + 1; col++) {
                const x = col * size * 3 + (row % 2) * size * 1.5;
                const y = row * h;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 180) * (60 * i - 30);
                    const px = x + size * Math.cos(angle);
                    const py = y + size * Math.sin(angle);
                    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.stroke();
            }
        }

        // ambient glow pools
        const pools = [
            { x: W * 0.15, y: H * 0.2,  r: W * 0.35, c: '100,255,218', a: 0.045 },
            { x: W * 0.85, y: H * 0.75, r: W * 0.30, c: '56,189,248',  a: 0.035 },
            { x: W * 0.50, y: H * 0.50, r: W * 0.25, c: '147,112,219', a: 0.025 },
        ];
        pools.forEach(p => {
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
            g.addColorStop(0, `rgba(${p.c},${p.a})`);
            g.addColorStop(1, `rgba(${p.c},0)`);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);
        });
    }

    function loop() {
        drawBackground();

        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            for (let j = i + 1; j < particles.length; j++) {
                const dx   = particles[i].x - particles[j].x;
                const dy   = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < MAX_DIST) {
                    const alpha = (1 - dist / MAX_DIST) * 0.55;
                    ctx.strokeStyle = `rgba(${particles[i].col},${alpha})`;
                    ctx.lineWidth   = 0.9;
                    ctx.shadowColor = `rgba(${particles[i].col},0.3)`;
                    ctx.shadowBlur  = 3;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }
            }
            particles[i].draw();
        }

        requestAnimationFrame(loop);
    }

    window.addEventListener('resize', resize);
    init();
    loop();
})();
