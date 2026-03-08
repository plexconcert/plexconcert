/**
 * Plex Animation — Organic & Hypnotic with Retreat Aura
 *
 * Dots wander freely. Periodically a small "team" gathers into a visible
 * retreat circle, confined within it, shining with a warm aura. Then they
 * disperse back into the open. Two overlapping team cycles.
 */

(function () {
  const canvas = document.getElementById('plex-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  let dots = [];
  let mouseX = -1000, mouseY = -1000;
  let animationId;

  // --- Configuration ---
  const DOT_COUNT = 180;
  const CONNECTION_DIST = 120;      // strong connections
  const CONNECTION_DIST_FAR = 350;  // faint connections between all dots
  const TEAM_SIZE = 12;
  const TEAM_CYCLE = 24;            // long cycle — plenty of calm wandering between retreats
  const TEAM_PULL = 0.0012;         // ultra gentle magnetic pull
  const RETREAT_RADIUS = 70;
  const BASE_RADIUS = 2;
  const BREATH_RADIUS = 1.2;

  // Colors
  const COLOR_REST = { r: 100, g: 116, b: 139 };
  const COLOR_GLOW = { r: 245, g: 158, b: 11 };

  // --- Global Breathing ---
  // A shared rhythm that the entire field inhales/exhales together
  const GLOBAL_BREATH_FREQ = 0.12;  // ~8 second cycle — slow, calming
  function globalBreath(time) {
    // Layered sine for organic feel (not a perfect sine wave)
    return (
      Math.sin(time * GLOBAL_BREATH_FREQ * Math.PI * 2) * 0.6 +
      Math.sin(time * GLOBAL_BREATH_FREQ * Math.PI * 2 * 0.5 + 0.7) * 0.4
    ) * 0.5 + 0.5; // normalized 0-1
  }

  // --- Helpers ---
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(t) { return t * t * (3 - 2 * t); }
  // Softer easing — gentler than smoothstep at the transitions
  function softease(t) { const s = smoothstep(t); return smoothstep(s); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function lerpColor(c1, c2, t) {
    return {
      r: Math.round(lerp(c1.r, c2.r, t)),
      g: Math.round(lerp(c1.g, c2.g, t)),
      b: Math.round(lerp(c1.b, c2.b, t)),
    };
  }

  function dist(x1, y1, x2, y2) {
    const dx = x1 - x2, dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function flowNoise(time, phase, freq1, freq2, freq3) {
    return (
      Math.sin(time * freq1 + phase) * 0.5 +
      Math.sin(time * freq2 + phase * 1.7) * 0.3 +
      Math.sin(time * freq3 + phase * 0.6) * 0.2
    );
  }

  // --- Dot ---
  class Dot {
    constructor(i) {
      this.id = i;
      this.x = Math.random() * (width || 1280);
      this.y = Math.random() * (height || 800);

      this.pxA = Math.random() * Math.PI * 2;
      this.pyA = Math.random() * Math.PI * 2;
      this.fxA = 0.04 + Math.random() * 0.03;
      this.fxB = 0.08 + Math.random() * 0.05;
      this.fxC = 0.14 + Math.random() * 0.06;
      this.fyA = 0.035 + Math.random() * 0.03;
      this.fyB = 0.07 + Math.random() * 0.05;
      this.fyC = 0.12 + Math.random() * 0.06;

      this.breathPhase = Math.random() * Math.PI * 2;
      this.breathFreq = 0.3 + Math.random() * 0.25;

      this.glow = 0;
      this.targetGlow = 0;
      // Residual glow that persists after leaving the retreat and fades slowly
      this.residualGlow = 0;
      // How strongly this dot is confined to a retreat circle (0 = free, 1 = fully confined)
      this.confinement = 0;
      this.targetConfinement = 0;
      this.confineX = 0;
      this.confineY = 0;
      this.confineRadius = RETREAT_RADIUS;
      // Orbital angle for rotation inside retreat circle
      this.orbitalAngle = Math.random() * Math.PI * 2;
      this.orbitalSpeed = (0.08 + Math.random() * 0.08) * (Math.random() < 0.5 ? 1 : -1);
      this.orbitalDist = 0.3 + Math.random() * 0.6; // fraction of retreat radius
    }

    scatter() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
    }

    getBreath(time) {
      return (Math.sin(time * this.breathFreq + this.breathPhase) + 1) * 0.5;
    }

    update(time, gBreath) {
      // Drift speed modulated by global breath — slows on inhale, drifts on exhale
      const driftScale = 0.18 + gBreath * 0.12; // range: 0.18–0.30
      const driftX = flowNoise(time, this.pxA, this.fxA, this.fxB, this.fxC) * driftScale;
      const driftY = flowNoise(time, this.pyA, this.fyA, this.fyB, this.fyC) * driftScale;
      this.x += driftX;
      this.y += driftY;

      // Mouse repulsion — gentle, no sudden push
      const md = dist(this.x, this.y, mouseX, mouseY);
      if (md < 150 && md > 0) {
        const force = (150 - md) / 150 * 0.4;
        this.x += ((this.x - mouseX) / md) * force;
        this.y += ((this.y - mouseY) / md) * force;
      }

      // Smooth confinement interpolation — ultra slow for magnetic feel, no sudden changes
      this.confinement += (this.targetConfinement - this.confinement) * 0.005;

      // Confine to retreat circle when active
      if (this.confinement > 0.01) {
        const d = dist(this.x, this.y, this.confineX, this.confineY);
        if (d > this.confineRadius) {
          const overshoot = d - this.confineRadius;
          const angle = Math.atan2(this.y - this.confineY, this.x - this.confineX);
          // Very gentle magnetic push back — no sudden corrections
          this.x -= Math.cos(angle) * overshoot * this.confinement * 0.03;
          this.y -= Math.sin(angle) * overshoot * this.confinement * 0.03;
        }
      }

      // Soft boundary wrap
      const margin = 60;
      if (this.x < -margin) this.x += width + margin * 2;
      if (this.x > width + margin) this.x -= width + margin * 2;
      if (this.y < -margin) this.y += height + margin * 2;
      if (this.y > height + margin) this.y -= height + margin * 2;

      // Smooth glow interpolation — slow for gradual magnetic glow
      // Effective target is whichever is higher: team glow or residual glow
      const effectiveGlow = Math.max(this.targetGlow, this.residualGlow);
      this.glow += (effectiveGlow - this.glow) * 0.008;
      // Slowly decay residual glow (particles "wear off" after leaving)
      if (this.residualGlow > 0) {
        this.residualGlow *= 0.996; // slow exponential decay
        if (this.residualGlow < 0.01) this.residualGlow = 0;
      }
    }
  }

  // --- Team Slot ---
  class TeamSlot {
    constructor(offset) {
      this.offset = offset;
      this.members = [];
      this.anchorX = 0;
      this.anchorY = 0;
      this.centroidX = 0;
      this.centroidY = 0;
      this.auraStrength = 0;     // 0-1, drives the visible aura glow
      this.lastPickTime = -999;
      // Smooth magnetic fade — interpolates gradually, never jumps
      this.magneticStrength = 0;
      this.targetMagnetic = 0;
      // Quadrant tracking: 0=TL, 1=TR, 2=BL, 3=BR — don't repeat
      this.lastQuadrant = -1;
    }

    getPhase(time) {
      return ((time + this.offset) % TEAM_CYCLE) / TEAM_CYCLE;
    }

    computeCentroid(allDots) {
      if (this.members.length === 0) return;
      let cx = 0, cy = 0;
      for (const idx of this.members) {
        cx += allDots[idx].x;
        cy += allDots[idx].y;
      }
      this.centroidX = cx / this.members.length;
      this.centroidY = cy / this.members.length;
    }

    update(time, allDots) {
      const phase = this.getPhase(time);

      if (phase < 0.02 && time - this.lastPickTime > TEAM_CYCLE * 0.8) {
        this.pickTeam(allDots);
        this.lastPickTime = time;
      }

      this.computeCentroid(allDots);

      // Phase: 0-0.15 Form | 0.15-0.35 Shine (retreat) | 0.35-0.50 Disperse | 0.50-1.0 Wander (long calm)
      const formEnd = 0.15;
      const shineEnd = 0.35;
      const disperseEnd = 0.50;

      if (phase < formEnd) {
        // FORM: set magnetic target — the actual strength fades in smoothly below
        const t = softease(phase / formEnd);
        this.targetMagnetic = t;
        this.setConfinement(allDots, t);
        this.setMemberGlow(allDots, t * 0.5);
        this.auraStrength = t * 0.6;
      } else if (phase < shineEnd) {
        // SHINE / RETREAT: fully confined in circle, bright aura
        const t = (phase - formEnd) / (shineEnd - formEnd);
        this.targetMagnetic = 1.0;
        this.setConfinement(allDots, 1.0);
        // Pulsing glow
        const pulse = 0.8 + Math.sin(t * Math.PI * 3) * 0.2;
        this.setMemberGlow(allDots, pulse);
        this.auraStrength = 0.7 + Math.sin(t * Math.PI * 2) * 0.15;
        // Slow orbital rotation inside retreat circle — shows growth & change
        const cx = this.centroidX;
        const cy = this.centroidY;
        for (const idx of this.members) {
          const dot = allDots[idx];
          // Advance orbital angle — slow, meditative turning
          dot.orbitalAngle += dot.orbitalSpeed * 0.016;
          // Slowly shift orbital distance to show position changes
          dot.orbitalDist += Math.sin(time * 0.3 + dot.id) * 0.002;
          dot.orbitalDist = clamp(dot.orbitalDist, 0.2, 0.85);
          // Compute target orbital position within retreat circle
          const targetR = RETREAT_RADIUS * dot.orbitalDist;
          const targetX = cx + Math.cos(dot.orbitalAngle) * targetR;
          const targetY = cy + Math.sin(dot.orbitalAngle) * targetR;
          // Very gently guide dot toward orbital position — no snapping
          dot.x += (targetX - dot.x) * 0.006;
          dot.y += (targetY - dot.y) * 0.006;
        }
      } else if (phase < disperseEnd) {
        // DISPERSE: fade out magnetic target — actual strength fades smoothly
        const t = softease((phase - shineEnd) / (disperseEnd - shineEnd));
        this.targetMagnetic = 1.0 - t;
        this.setConfinement(allDots, 1.0 - t);
        // Keep team glow high during early dispersal, then hand off to residualGlow
        this.setMemberGlow(allDots, Math.max(0.7 * (1.0 - t * 0.3), 0));
        this.auraStrength = (1.0 - t) * 0.6;
        // At the start of dispersal, stamp residual glow on each member
        if (t < 0.1) {
          for (const idx of this.members) {
            allDots[idx].residualGlow = Math.max(allDots[idx].residualGlow, 0.8);
          }
        }
      } else {
        // WANDER: everything free
        this.targetMagnetic = 0;
        this.setConfinement(allDots, 0);
        this.setMemberGlow(allDots, 0);
        this.auraStrength = 0;
      }

      // Smooth magnetic fade in/out — never jumps, always interpolates
      this.magneticStrength += (this.targetMagnetic - this.magneticStrength) * 0.006;
      this.applyPull(allDots, this.magneticStrength);
    }

    pickTeam(allDots) {
      const pad = 120;
      const halfW = width / 2;
      const halfH = height / 2;

      // Pick a quadrant that's different from last time
      // Quadrants: 0=TL, 1=TR, 2=BL, 3=BR
      const available = [0, 1, 2, 3].filter(q => q !== this.lastQuadrant);
      const quadrant = available[Math.floor(Math.random() * available.length)];
      this.lastQuadrant = quadrant;

      // Determine bounds for the chosen quadrant (with padding)
      const qLeft  = (quadrant % 2 === 0) ? pad : halfW + pad * 0.5;
      const qRight = (quadrant % 2 === 0) ? halfW - pad * 0.5 : width - pad;
      const qTop   = (quadrant < 2)       ? pad : halfH + pad * 0.5;
      const qBot   = (quadrant < 2)       ? halfH - pad * 0.5 : height - pad;

      this.anchorX = qLeft + Math.random() * (qRight - qLeft);
      this.anchorY = qTop + Math.random() * (qBot - qTop);

      const sorted = allDots
        .map((d, i) => ({ i, d: dist(d.x, d.y, this.anchorX, this.anchorY) }))
        .sort((a, b) => a.d - b.d);

      this.members = sorted.slice(0, TEAM_SIZE).map(s => s.i);

      // Assign evenly-spaced orbital angles for nice rotation pattern
      const angleStep = (Math.PI * 2) / this.members.length;
      this.members.forEach((idx, k) => {
        allDots[idx].orbitalAngle = angleStep * k + Math.random() * 0.3;
        allDots[idx].orbitalDist = 0.3 + Math.random() * 0.5;
      });
    }

    applyPull(allDots, strength) {
      if (strength <= 0 || this.members.length === 0) return;

      for (const idx of this.members) {
        const dot = allDots[idx];
        dot.x += (this.centroidX - dot.x) * TEAM_PULL * strength;
        dot.y += (this.centroidY - dot.y) * TEAM_PULL * strength;
      }
    }

    setConfinement(allDots, value) {
      for (const idx of this.members) {
        allDots[idx].targetConfinement = Math.max(allDots[idx].targetConfinement, value);
        allDots[idx].confineX = this.centroidX;
        allDots[idx].confineY = this.centroidY;
        allDots[idx].confineRadius = RETREAT_RADIUS;
      }
    }

    setMemberGlow(allDots, value) {
      for (const idx of this.members) {
        allDots[idx].targetGlow = Math.max(allDots[idx].targetGlow, value);
      }
    }

    // Draw the retreat aura behind the cluster
    drawAura(ctx, time) {
      if (this.auraStrength < 0.02) return;

      const gBreath = globalBreath(time);
      const s = this.auraStrength;
      const cx = this.centroidX;
      const cy = this.centroidY;

      // Aura breathes — radius expands/contracts gently with global breath
      const breathScale = 1.0 + (gBreath - 0.5) * 0.15; // ±7.5% size change

      // Outer soft aura — large warm glow
      const outerRadius = RETREAT_RADIUS * 2.8 * breathScale;
      const outerGrad = ctx.createRadialGradient(cx, cy, RETREAT_RADIUS * 0.3, cx, cy, outerRadius);
      outerGrad.addColorStop(0, `rgba(245, 158, 11, ${s * 0.12})`);
      outerGrad.addColorStop(0.4, `rgba(245, 158, 11, ${s * 0.06})`);
      outerGrad.addColorStop(1, `rgba(245, 158, 11, 0)`);
      ctx.beginPath();
      ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
      ctx.fillStyle = outerGrad;
      ctx.fill();

      // Inner core aura — brighter, tighter, also breathes
      const innerRadius = RETREAT_RADIUS * 1.4 * breathScale;
      const innerGrad = ctx.createRadialGradient(cx, cy, RETREAT_RADIUS * 0.1, cx, cy, innerRadius);
      innerGrad.addColorStop(0, `rgba(245, 180, 50, ${s * 0.15})`);
      innerGrad.addColorStop(0.6, `rgba(245, 158, 11, ${s * 0.07})`);
      innerGrad.addColorStop(1, `rgba(245, 158, 11, 0)`);
      ctx.beginPath();
      ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
      ctx.fillStyle = innerGrad;
      ctx.fill();

      // Subtle ring at the retreat boundary
      const ringOpacity = s * 0.15;
      ctx.beginPath();
      ctx.arc(cx, cy, RETREAT_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(245, 158, 11, ${ringOpacity})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // --- State ---
  let teams = [];

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    width = canvas.width = rect.width;
    height = canvas.height = rect.height;
  }

  function init() {
    resize();
    dots = [];
    for (let i = 0; i < DOT_COUNT; i++) {
      dots.push(new Dot(i));
    }
    teams = [
      new TeamSlot(TEAM_CYCLE - 2),          // first effect visible ~2s after load
      new TeamSlot(TEAM_CYCLE / 2 - 2),      // second slot keeps same 12s offset
    ];
  }

  function draw(timestamp) {
    const time = timestamp / 1000;

    ctx.clearRect(0, 0, width, height);

    // Global breathing rhythm — shared by all dots
    const gBreath = globalBreath(time);

    // Connection distance breathes — web of connections expands/contracts
    const connDist = CONNECTION_DIST * (0.92 + gBreath * 0.16);   // ±8% range
    const connDistFar = CONNECTION_DIST_FAR * (0.92 + gBreath * 0.16);

    // Reset targets
    for (const dot of dots) {
      dot.targetGlow = 0;
      dot.targetConfinement = 0;
    }

    // Update teams
    for (const team of teams) {
      team.update(time, dots);
    }

    // Update dots (pass global breath)
    for (const dot of dots) {
      dot.update(time, gBreath);
    }

    // --- Draw retreat auras (behind everything) ---
    for (const team of teams) {
      team.drawAura(ctx, time);
    }

    // --- Draw connections (every dot connected to every other dot) ---
    const maxDist = Math.sqrt(width * width + height * height); // screen diagonal
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const d = dist(dots[i].x, dots[i].y, dots[j].x, dots[j].y);

        // Glow only counts when BOTH dots are glowing (both inside retreat circle)
        const bothGlow = Math.min(dots[i].glow, dots[j].glow);
        // Blend individual breath with global breath for connection strength
        const avgBreath = (dots[i].getBreath(time) + dots[j].getBreath(time)) * 0.3 + gBreath * 0.4;
        const breathFactor = 0.6 + avgBreath * 0.4;
        let opacity, lineWidth;

        if (d < connDist) {
          // Close connection — strength modulated by breathing
          const proximity = 1 - d / connDist;
          opacity = proximity * 0.15 * breathFactor + proximity * bothGlow * 0.5;
          lineWidth = 0.8 + bothGlow * 2.0 + avgBreath * 0.6;
        } else if (d < connDistFar) {
          // Mid-range connection — faint
          const proximity = 1 - (d - connDist) / (connDistFar - connDist);
          opacity = proximity * 0.025 * breathFactor + proximity * bothGlow * 0.08;
          lineWidth = 0.4 + bothGlow * 0.6;
        } else {
          // Universal connection — very thin line between all dots
          const proximity = 1 - (d - connDistFar) / (maxDist - connDistFar);
          opacity = proximity * 0.012 * breathFactor;
          lineWidth = 0.3;
        }

        if (opacity < 0.003) continue;

        const color = lerpColor(COLOR_REST, COLOR_GLOW, bothGlow);
        ctx.beginPath();
        ctx.moveTo(dots[i].x, dots[i].y);
        ctx.lineTo(dots[j].x, dots[j].y);
        ctx.strokeStyle = `rgba(${color.r},${color.g},${color.b},${opacity})`;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    }

    // --- Draw dots ---
    for (const dot of dots) {
      const g = dot.glow;
      // Blend individual + global breath for dot rendering
      const breath = dot.getBreath(time) * 0.6 + gBreath * 0.4;
      const color = lerpColor(COLOR_REST, COLOR_GLOW, g);

      const radius = BASE_RADIUS + breath * BREATH_RADIUS + g * 1.5;
      const baseAlpha = 0.3 + breath * 0.25 + g * 0.45;

      // Individual halo
      const haloStrength = g * 0.8 + breath * 0.1;
      if (haloStrength > 0.1) {
        const haloRadius = radius * (2 + haloStrength * 4);
        const gradient = ctx.createRadialGradient(dot.x, dot.y, radius * 0.3, dot.x, dot.y, haloRadius);
        gradient.addColorStop(0, `rgba(${color.r},${color.g},${color.b},${haloStrength * 0.2})`);
        gradient.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, haloRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Core dot
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${baseAlpha})`;
      ctx.fill();
    }

    animationId = requestAnimationFrame(draw);
  }

  // --- Events ---
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });

  canvas.addEventListener('mouseleave', () => {
    mouseX = -1000;
    mouseY = -1000;
  });

  window.addEventListener('resize', () => {
    resize();
    dots.forEach(d => d.scatter());
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationId);
    } else {
      animationId = requestAnimationFrame(draw);
    }
  });

  // --- Start ---
  init();
  animationId = requestAnimationFrame(draw);
})();
