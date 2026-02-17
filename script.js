const XMIN = -22, XMAX = 90;
const YMIN = 0,   YMAX = 60000;

const $ = (id) => document.getElementById(id);
const canvas = $("chart");
const ctx = canvas.getContext("2d");
const wrap = $("chartWrap");

function makePointRow(i, use=true, t=0, q=0){
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="checkbox" class="use useBox" ${use ? "checked":""} aria-label="use point ${i+1}" /></td>
    <td><input type="number" class="t tableInput" step="0.1" value="${t}" /></td>
    <td><input type="number" class="q tableInput" step="100" value="${q}" /></td>
  `;
  return tr;
}

function initTable(){
  const body = $("ptBody");
  body.innerHTML = "";
  body.appendChild(makePointRow(0, true,  47, 36000));
  body.appendChild(makePointRow(1, true,  17, 30000));
  body.appendChild(makePointRow(2, true,   5, 26000));
  body.appendChild(makePointRow(3, false, -5, 22000));
}

function readOutputPoints(){
  const rows = Array.from($("ptBody").querySelectorAll("tr"));
  const pts = [];
  for(const r of rows){
    const use = r.querySelector(".use").checked;
    const t = Number(r.querySelector(".t").value);
    const q = Number(r.querySelector(".q").value);
    if(use && isFinite(t) && isFinite(q)) pts.push({x:t, y:q});
  }
  return pts;
}

function fitLineLeastSquares(pts){
  const n = pts.length;
  let sx=0, sy=0, sxx=0, sxy=0;
  for(const p of pts){ sx += p.x; sy += p.y; sxx += p.x*p.x; sxy += p.x*p.y; }
  const denom = (n*sxx - sx*sx);
  if(Math.abs(denom) < 1e-12) return {m:0, b: sy/n};
  const m = (n*sxy - sx*sy) / denom;
  const b = (sy - m*sx) / n;
  return {m,b};
}

function lineFromTwoPoints(x1,y1,x2,y2){
  const dx = (x2-x1);
  if(Math.abs(dx) < 1e-9) return {m:0, b:y1};
  const m = (y2-y1)/dx;
  const b = y1 - m*x1;
  return {m,b};
}

function intersectLines(l1, l2){
  const dm = (l1.m - l2.m);
  if(Math.abs(dm) < 1e-12) return null;
  const x = (l2.b - l1.b) / dm;
  const y = l1.m * x + l1.b;
  return {x, y};
}

function canvasCssHeight(){
  // Match CSS media rule
  return window.matchMedia("(max-width:560px)").matches ? 360 : 520;
}

function resizeCanvas(){
  const cssH = canvasCssHeight();
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  // Let CSS control width; we only control height.
  canvas.style.width = "100%";
  canvas.style.height = cssH + "px";

  // Measure actual rendered size (prevents aspect/proportion issues on mobile).
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);

  // Draw in CSS pixels.
  ctx.setTransform(dpr,0,0,dpr,0,0);
}

function plotFrame(){
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
// Slightly tighter margins on small screens
  const isMobile = window.matchMedia("(max-width:560px)").matches;
  const L = isMobile ? 62 : 76;
  const R = isMobile ? 16 : 20;
  const T = isMobile ? 14 : 18;
  const B = isMobile ? 38 : 44;

  const W = w - L - R, H = h - T - B;
  ctx.clearRect(0,0,w,h);

  // grid
  ctx.strokeStyle = "#e6f1f8";
  ctx.lineWidth = 1;
  for(let i=0;i<=6;i++){
    const yy = T + H - (i/6)*H;
    ctx.beginPath(); ctx.moveTo(L,yy); ctx.lineTo(L+W,yy); ctx.stroke();
  }
  for(let i=0;i<=8;i++){
    const xx = L + (i/8)*W;
    ctx.beginPath(); ctx.moveTo(xx,T); ctx.lineTo(xx,T+H); ctx.stroke();
  }

  // axes
  ctx.strokeStyle = "#b8cfe0";
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(L,T); ctx.lineTo(L,T+H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L,T+H); ctx.lineTo(L+W,T+H); ctx.stroke();

  // ticks + labels
  ctx.fillStyle = "#4a6275";
  ctx.font = (isMobile ? "10px" : "12px") + " system-ui";

  for(let i=0;i<=6;i++){
    const v = Math.round((i/6)*(YMAX-YMIN)+YMIN);
    const yy = T + H - (i/6)*H;
    ctx.fillText(v.toLocaleString(), 10, yy+4);
  }

  for(let i=0;i<=8;i++){
    const v = (i/8)*(XMAX-XMIN)+XMIN;
    const xx = L + (i/8)*W;
    ctx.fillText(v.toFixed(0), xx-9, T+H+22);
  }

  // BTU/h label moved away from top tick
  ctx.save();
  ctx.translate(18, T + 50);
  ctx.rotate(-Math.PI/2);
  ctx.fillText("BTU/h", 0, 0);
  ctx.restore();

  ctx.fillText("Outdoor Temp (°F)", L + W - (isMobile ? 126 : 150), T+H+(isMobile ? 34 : 40));

  function sx(x){ return L + ((x - XMIN) / (XMAX - XMIN)) * W; }
  function sy(y){ return T + (1 - (y - YMIN) / (YMAX - YMIN)) * H; }

  return {sx, sy, L, T, W, H};
}

function drawLineInfinite(line, color, frame){
  const xA = XMIN, yA = line.m*xA + line.b;
  const xB = XMAX, yB = line.m*xB + line.b;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(frame.sx(xA), frame.sy(yA));
  ctx.lineTo(frame.sx(xB), frame.sy(yB));
  ctx.stroke();
}

function drawSegment(x1,y1,x2,y2,color,frame){
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(frame.sx(x1), frame.sy(y1));
  ctx.lineTo(frame.sx(x2), frame.sy(y2));
  ctx.stroke();
}

function drawPoints(pts, frame){
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || "#ffd24d";
  for(const p of pts){
    ctx.beginPath();
    ctx.arc(frame.sx(p.x), frame.sy(p.y), 5, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "#c8dceb";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawVertical(x, color, frame, dotted=false){
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash(dotted ? [6,6] : []);
  ctx.beginPath();
  ctx.moveTo(frame.sx(x), frame.sy(YMIN));
  ctx.lineTo(frame.sx(x), frame.sy(YMAX));
  ctx.stroke();
  ctx.setLineDash([]);
}

function update(){
  const pts = readOutputPoints();
  const designTempF = Number($("designTempF").value);
  const heatDemandBtu = Number($("heatDemandBtu").value);
  const minOpRaw = $("minOpTempF").value.trim();
  const minOpTempF = (minOpRaw === "") ? null : Number(minOpRaw);

  const frame = plotFrame();

  // Demand line: always defined by (65,0) and design point
  const demLine = lineFromTwoPoints(65, 0, designTempF, heatDemandBtu);

  // Demand segment must include:
  // - from 65°F,0 through design point
  // - continue to minOp if provided; otherwise stop at 65 (i.e., just a segment 65->design)
  // We'll always draw from x=65 to x=design, and if minOp exists, extend to x=minOp as well.
  const blue = getComputedStyle(document.documentElement).getPropertyValue('--lineBlue').trim() || "#2e86ff";

  // Segment 1: 65 -> design
  drawSegment(65, 0, designTempF, heatDemandBtu, blue, frame);

  // Segment 2 (optional): design -> minOp (line continuation)
  if(minOpTempF !== null && isFinite(minOpTempF)){
    // dotted vertical at min op
    drawVertical(minOpTempF, blue, frame, true);
    // extend demand line to minOp
    const yAtMin = demLine.m * minOpTempF + demLine.b;
    drawSegment(designTempF, heatDemandBtu, minOpTempF, yAtMin, blue, frame);
  }

  // Need 2..4 points
  if(pts.length < 2 || pts.length > 4){
    $("bpOut").innerHTML = "—<small>°F</small>";
    $("bpRight").textContent = "Select 2–4 output points.";
    drawPoints(pts, frame);
    return;
  }

  // Output line + points
  const out = fitLineLeastSquares(pts);
  drawLineInfinite(out, getComputedStyle(document.documentElement).getPropertyValue('--danger').trim() || "#ff5a5f", frame);
  drawPoints(pts, frame);

  // Balance point (intersection of infinite lines)
  const hit = intersectLines(out, demLine);
  if(!hit || !isFinite(hit.x) || !isFinite(hit.y)){
    $("bpOut").innerHTML = "—<small>°F</small>";
    $("bpRight").textContent = "No unique intersection.";
    return;
  }

  drawVertical(hit.x, getComputedStyle(document.documentElement).getPropertyValue('--ok').trim() || "#19c37d", frame, false);

  $("bpOut").innerHTML = `${hit.x.toFixed(1)}<small>°F</small>`;
  $("bpRight").textContent = " ";
}

function redraw(){
  resizeCanvas();
  update();
}

document.addEventListener("input", (e) => {
  if(e.target.closest("#ptBody") || e.target.id==="designTempF" || e.target.id==="heatDemandBtu" || e.target.id==="minOpTempF"){
    update();
  }
});

window.addEventListener("resize", () => {
  window.requestAnimationFrame(redraw);
});

initTable();
redraw();
