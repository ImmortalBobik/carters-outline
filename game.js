/**
 * CARTER'S OUTLINE — MINIMALIST GAME ENGINE (NO SOUND, SLOW & SMOOTH)
 */

(function () {
  'use strict';

  const STATE = {
    IDLE: 'IDLE',
    GROWING: 'GROWING',
    WRAPPING: 'WRAPPING',
    RESULT: 'RESULT',
  };

  let currentState = STATE.IDLE;
  let headsData = window.CARTER_HEADS || [];
  let currentHeadIndex = 0;
  let loadedImages = {};

  // Slower, calmer stick growth & wrapping speeds
  let stickLength = 0;
  const GROW_SPEED = 260; // Slower growth (pixels per second)
  let lastTimestamp = 0;

  let wrapStartTime = 0;
  const WRAP_DURATION = 2200; // Slower, satisfying 2.2s wrap around the head
  let wrappedLength = 0;

  // Camera Zoom & Pan
  let currentZoom = 1.0;
  let targetZoom = 1.0;
  let currentPanY = 0;
  let targetPanY = 0;

  // Stats
  let streak = 0;
  let bestAccuracy = 0;

  // DOM Elements
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const streakVal = document.getElementById('streakVal');
  const bestAccVal = document.getElementById('bestAccVal');
  const faceStrip = document.getElementById('faceStrip');
  const resultModal = document.getElementById('resultModal');
  const resultTag = document.getElementById('resultTag');
  const resultAccuracy = document.getElementById('resultAccuracy');
  const resultBreakdown = document.getElementById('resultBreakdown');

  function preloadImages() {
    headsData.forEach((head) => {
      const img = new Image();
      img.src = head.image;
      img.onload = () => {
        loadedImages[head.id] = img;
      };
    });
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 500 * dpr;
    canvas.height = 500 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function renderFaceSelector() {
    faceStrip.innerHTML = '';
    headsData.forEach((head, idx) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `face-thumb-card ${idx === currentHeadIndex ? 'active' : ''}`;
      card.title = head.name;
      card.innerHTML = `
        <div class="face-thumb-img-wrap">
          <img src="${head.image}" alt="${head.name}">
        </div>
      `;
      card.addEventListener('click', () => selectFace(idx));
      faceStrip.appendChild(card);
    });
  }

  function selectFace(idx) {
    currentHeadIndex = (idx + headsData.length) % headsData.length;
    resetRound();
    updateUI();
  }

  function updateUI() {
    streakVal.textContent = streak;
    bestAccVal.textContent = `${bestAccuracy.toFixed(1)}%`;

    const cards = faceStrip.querySelectorAll('.face-thumb-card');
    cards.forEach((c, i) => {
      c.classList.toggle('active', i === currentHeadIndex);
    });
  }

  function resetRound() {
    currentState = STATE.IDLE;
    stickLength = 0;
    wrappedLength = 0;
    targetZoom = 1.0;
    targetPanY = 0;
    resultModal.classList.add('hidden');
  }

  function startGrowing() {
    if (currentState === STATE.RESULT) {
      resetRound();
      return;
    }
    if (currentState !== STATE.IDLE) return;

    currentState = STATE.GROWING;
    stickLength = 0;
  }

  function stopGrowing() {
    if (currentState !== STATE.GROWING) return;

    if (stickLength < 15) {
      resetRound();
      return;
    }

    currentState = STATE.WRAPPING;
    wrapStartTime = performance.now();
    targetZoom = 1.0;
    targetPanY = 0;
  }

  function evaluateWrapGeometry(head, currentLen) {
    const pts = head.contour;
    const perimeter = head.perimeter;
    const numPts = pts.length;

    let cum = 0;
    const wrappedPts = [pts[0]];
    let tipPt = pts[0];
    let tangentVec = [0, -1];

    const lenToContour = Math.min(currentLen, perimeter);

    for (let i = 0; i < numPts; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % numPts];
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const segLen = Math.hypot(dx, dy);

      if (cum + segLen >= lenToContour) {
        const t = Math.max(0, Math.min(1, (lenToContour - cum) / Math.max(0.001, segLen)));
        tipPt = [p1[0] + dx * t, p1[1] + dy * t];
        wrappedPts.push(tipPt);
        tangentVec = [dx / segLen, dy / segLen];
        break;
      } else {
        cum += segLen;
        wrappedPts.push(p2);
        tipPt = p2;
        tangentVec = [dx / segLen, dy / segLen];
      }
    }

    const remainingLen = Math.max(0, stickLength - currentLen);
    const overshootLen = Math.max(0, currentLen - perimeter);

    return { wrappedPts, tipPt, tangentVec, remainingLen, overshootLen };
  }

  function onWrapCompleted() {
    currentState = STATE.RESULT;
    const head = headsData[currentHeadIndex];
    const perimeter = head.perimeter;
    const diff = stickLength - perimeter;
    const diffPct = (diff / perimeter) * 100;
    const absDiffPct = Math.abs(diffPct);
    const accuracy = Math.max(0, 100 - absDiffPct);

    if (accuracy > bestAccuracy) {
      bestAccuracy = accuracy;
    }

    resultAccuracy.textContent = `${accuracy.toFixed(1)}%`;
    resultBreakdown.textContent = `${diff >= 0 ? '+' : ''}${diffPct.toFixed(1)}% (${Math.round(stickLength)} / ${Math.round(perimeter)}px)`;
    resultTag.className = 'result-tag';

    if (absDiffPct <= 3.5) {
      streak++;
      resultTag.textContent = 'PERFECT FIT';
      resultTag.classList.add('perfect');
    } else if (absDiffPct <= 8.0) {
      streak++;
      resultTag.textContent = 'CLOSE FIT';
      resultTag.classList.add('close');
    } else {
      streak = 0;
      resultTag.textContent = diff > 0 ? 'TOO LONG' : 'TOO SHORT';
      resultTag.classList.add('miss');
    }

    updateUI();
    resultModal.classList.remove('hidden');
  }

  function animate(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = Math.min(60, timestamp - lastTimestamp) / 1000.0;
    lastTimestamp = timestamp;

    const head = headsData[currentHeadIndex];

    if (currentState === STATE.GROWING) {
      stickLength += GROW_SPEED * dt;

      const requiredHeight = stickLength + 90;
      if (requiredHeight > 410) {
        targetZoom = Math.max(0.36, 410 / requiredHeight);
        targetPanY = (1.0 - targetZoom) * 190;
      } else {
        targetZoom = 1.0;
        targetPanY = 0;
      }
    }

    if (currentState === STATE.WRAPPING) {
      const elapsed = timestamp - wrapStartTime;
      const progress = Math.min(1.0, elapsed / WRAP_DURATION);
      // Smooth ease-in-out / cubic ease-out for calm wrapping
      const ease = 1.0 - Math.pow(1.0 - progress, 2.4);
      wrappedLength = ease * stickLength;

      if (progress >= 1.0) {
        wrappedLength = stickLength;
        onWrapCompleted();
      }
    }

    currentZoom += (targetZoom - currentZoom) * 0.08;
    currentPanY += (targetPanY - currentPanY) * 0.08;

    renderScene(head);
    requestAnimationFrame(animate);
  }

  function renderScene(head) {
    ctx.clearRect(0, 0, 500, 500);
    if (!head) return;

    ctx.save();
    ctx.translate(250, 250 + currentPanY);
    ctx.scale(currentZoom, currentZoom);
    ctx.translate(-250, -250);

    const chin = head.chinAnchor;
    const launchX = 76;
    const launchY = chin[1];

    // Minimalist Launch Rail
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(24, 24, 27, 0.08)';
    ctx.lineWidth = 1.5;
    ctx.moveTo(launchX, launchY);
    ctx.lineTo(launchX, -1200);
    ctx.stroke();

    // Launch Origin Dot
    ctx.beginPath();
    ctx.fillStyle = '#18181B';
    ctx.arc(launchX, launchY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Carter's Head Cutout
    const img = loadedImages[head.id];
    if (img && img.complete) {
      ctx.drawImage(img, 0, 0, 500, 500);
    }

    // Subtle Target Outline Track
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(24, 24, 27, 0.14)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 6]);
    const pts = head.contour;
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Chin Anchor Point
    ctx.beginPath();
    ctx.fillStyle = '#10B981';
    ctx.arc(chin[0], chin[1], 4, 0, Math.PI * 2);
    ctx.fill();

    // Growing Stick
    if (currentState === STATE.GROWING) {
      const tipY = launchY - stickLength;

      ctx.strokeStyle = '#FF5A36';
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(launchX, launchY);
      ctx.lineTo(launchX, tipY);
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = '#FF5A36';
      ctx.arc(launchX, tipY, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Wrapping & Result Stick
    if (currentState === STATE.WRAPPING || currentState === STATE.RESULT) {
      const currentLen = currentState === STATE.WRAPPING ? wrappedLength : stickLength;
      const geom = evaluateWrapGeometry(head, currentLen);

      if (geom.wrappedPts.length > 1) {
        ctx.strokeStyle = '#FF5A36';
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(geom.wrappedPts[0][0], geom.wrappedPts[0][1]);
        for (let i = 1; i < geom.wrappedPts.length; i++) {
          ctx.lineTo(geom.wrappedPts[i][0], geom.wrappedPts[i][1]);
        }
        ctx.stroke();
      }

      if (geom.remainingLen > 1) {
        const tx = geom.tipPt[0];
        const ty = geom.tipPt[1];
        const ex = tx + geom.tangentVec[0] * geom.remainingLen;
        const ey = ty + geom.tangentVec[1] * geom.remainingLen;

        ctx.strokeStyle = '#FF5A36';
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }

      if (geom.overshootLen > 1) {
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const overCount = Math.min(
          geom.wrappedPts.length,
          Math.ceil((geom.overshootLen / head.perimeter) * pts.length) + 1
        );
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < overCount; i++) {
          ctx.lineTo(pts[i][0], pts[i][1]);
        }
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.fillStyle = '#FF5A36';
      ctx.arc(geom.tipPt[0], geom.tipPt[1], 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function advanceOrReset() {
    const head = headsData[currentHeadIndex];
    const absDiffPct = Math.abs(((stickLength - head.perimeter) / head.perimeter) * 100);
    if (absDiffPct <= 3.5) {
      selectFace(currentHeadIndex + 1);
    } else {
      resetRound();
    }
  }

  function setupInputs() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (e.repeat) return;
        if (currentState === STATE.RESULT) {
          advanceOrReset();
        } else if (currentState === STATE.IDLE) {
          startGrowing();
        }
      } else if (e.key >= '1' && e.key <= '5') {
        selectFace(parseInt(e.key, 10) - 1);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (currentState === STATE.GROWING) {
          stopGrowing();
        }
      }
    });

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (currentState === STATE.RESULT) {
        advanceOrReset();
      } else if (currentState === STATE.IDLE) {
        startGrowing();
      }
    });

    window.addEventListener('pointerup', () => {
      if (currentState === STATE.GROWING) {
        stopGrowing();
      }
    });

    window.addEventListener('pointercancel', () => {
      if (currentState === STATE.GROWING) {
        stopGrowing();
      }
    });

    resultModal.addEventListener('click', advanceOrReset);
    window.addEventListener('resize', resizeCanvas);
  }

  function init() {
    resizeCanvas();
    renderFaceSelector();
    updateUI();
    setupInputs();
    preloadImages();
    requestAnimationFrame(animate);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
