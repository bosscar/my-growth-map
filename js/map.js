const regionsGroup = document.getElementById('regions-group');
const labelsGroup = document.getElementById('labels-group');
const bridgesGroup = document.getElementById('bridges-group');
const mapSvg = document.getElementById('growth-map');
const mapContainer = document.getElementById('map-container');

// Store region data for click interactions
let currentRegions = {};

// Zoom and pan state
let zoom = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let startPanX = 0;
let startPanY = 0;

// Initialize zoom/pan controls
function initMapControls() {
    if (!mapContainer || !mapSvg) return;

    // Mouse wheel zoom
    mapContainer.addEventListener('wheel', (e) => {
        e.preventDefault();

        const rect = mapContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Zoom factor
        const zoomSpeed = 0.1;
        const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
        const newZoom = Math.max(0.5, Math.min(3, zoom + delta));

        // Adjust pan to zoom towards mouse position
        const zoomRatio = newZoom / zoom;
        panX = mouseX - (mouseX - panX) * zoomRatio;
        panY = mouseY - (mouseY - panY) * zoomRatio;

        zoom = newZoom;
        applyTransform();
    });

    // Pan with mouse drag
    mapContainer.addEventListener('mousedown', (e) => {
        if (e.target.closest('.region-node')) return; // Don't pan when clicking regions
        isPanning = true;
        startPanX = e.clientX - panX;
        startPanY = e.clientY - panY;
        mapContainer.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        panX = e.clientX - startPanX;
        panY = e.clientY - startPanY;
        applyTransform();
    });

    window.addEventListener('mouseup', () => {
        isPanning = false;
        if (mapContainer) mapContainer.style.cursor = 'grab';
    });

    // Double-click to reset zoom
    mapContainer.addEventListener('dblclick', (e) => {
        if (e.target.closest('.region-node')) return;
        zoom = 1;
        panX = 0;
        panY = 0;
        applyTransform();
    });

    // Set initial cursor
    mapContainer.style.cursor = 'grab';
}

function applyTransform() {
    if (!mapSvg) return;
    mapSvg.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    mapSvg.style.transformOrigin = '0 0';
}

// Initialize controls when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMapControls);
} else {
    initMapControls();
}

// Seed-based random for consistent shapes
function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// Create organic blob with consistent shape per region
function createBlobPath(x, y, size, seed = 0) {
    const points = 10;
    const angleStep = (Math.PI * 2) / points;
    const pathPoints = [];

    for (let i = 0; i < points; i++) {
        const angle = i * angleStep;
        const variation = seededRandom(seed + i * 100) * 0.5 + 0.75;
        const r = size * variation;
        pathPoints.push({
            x: x + Math.cos(angle) * r,
            y: y + Math.sin(angle) * r
        });
    }

    // Smooth cardinal spline
    let d = `M ${pathPoints[0].x},${pathPoints[0].y} `;
    for (let i = 0; i < points; i++) {
        const p0 = pathPoints[(i - 1 + points) % points];
        const p1 = pathPoints[i];
        const p2 = pathPoints[(i + 1) % points];
        const p3 = pathPoints[(i + 2) % points];

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        d += `C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y} `;
    }
    return d + 'Z';
}

function createGlowFilter(id, color) {
    const defs = document.querySelector('#growth-map defs');
    const filterId = `glow-${id}`;

    if (!document.getElementById(filterId)) {
        const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
        filter.setAttribute("id", filterId);
        filter.setAttribute("x", "-50%");
        filter.setAttribute("y", "-50%");
        filter.setAttribute("width", "200%");
        filter.setAttribute("height", "200%");

        const blur = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
        blur.setAttribute("stdDeviation", "8");
        blur.setAttribute("result", "coloredBlur");

        const merge = document.createElementNS("http://www.w3.org/2000/svg", "feMerge");
        const mergeNode1 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
        mergeNode1.setAttribute("in", "coloredBlur");
        const mergeNode2 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
        mergeNode2.setAttribute("in", "SourceGraphic");
        merge.appendChild(mergeNode1);
        merge.appendChild(mergeNode2);

        filter.appendChild(blur);
        filter.appendChild(merge);
        defs.appendChild(filter);
    }
    return filterId;
}

function createRadialGradient(id, color, intensity) {
    const defs = document.querySelector('#growth-map defs');
    const gradId = `grad-${id}`;

    // Remove old gradient if exists
    const existing = document.getElementById(gradId);
    if (existing) existing.remove();

    const grad = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
    grad.setAttribute("id", gradId);
    grad.setAttribute("cx", "30%");
    grad.setAttribute("cy", "30%");
    grad.setAttribute("r", "70%");

    const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop1.setAttribute("offset", "0%");
    stop1.setAttribute("stop-color", color);
    stop1.setAttribute("stop-opacity", Math.min(0.9, 0.4 + intensity * 0.5));

    const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop2.setAttribute("offset", "100%");
    stop2.setAttribute("stop-color", color);
    stop2.setAttribute("stop-opacity", Math.min(0.6, 0.15 + intensity * 0.3));

    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);

    return gradId;
}

function showRegionDetails(region) {
    // Create or update a tooltip/detail panel
    let tooltip = document.getElementById('region-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'region-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(10, 10, 30, 0.95);
            backdrop-filter: blur(20px);
            border: 2px solid ${region.color};
            border-radius: 24px;
            padding: 2rem;
            z-index: 500;
            min-width: 300px;
            box-shadow: 0 0 60px ${region.color}40;
            animation: tooltipFadeIn 0.3s ease;
        `;
        document.body.appendChild(tooltip);

        // Add click outside to close
        setTimeout(() => {
            document.addEventListener('click', function closeTooltip(e) {
                if (!tooltip.contains(e.target)) {
                    tooltip.remove();
                    document.removeEventListener('click', closeTooltip);
                }
            });
        }, 100);
    }

    const entries = window.AppData?.entries?.filter(e =>
        e.analysis.parts.some(p => p.id.toLowerCase() === region.id.toLowerCase())
    ) || [];

    tooltip.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
            <div style="width: 50px; height: 50px; border-radius: 50%; background: ${region.color}; box-shadow: 0 0 30px ${region.color};"></div>
            <div>
                <h2 style="margin: 0; color: ${region.color}; font-size: 1.5rem;">${region.name}</h2>
                <p style="margin: 0; color: #8a8aa3; font-size: 0.9rem;">Intensity: ${Math.round(region.intensity * 100)}%</p>
            </div>
        </div>
        <div style="margin-bottom: 1rem;">
            <p style="color: white; margin: 0;">This region has grown <strong style="color: ${region.color};">${Math.round(region.size)}px</strong> based on your reflections.</p>
        </div>
        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem;">
            <p style="color: #8a8aa3; font-size: 0.8rem; margin: 0;">${entries.length} journal entries mention this part</p>
        </div>
        <button onclick="this.parentElement.remove()" style="
            margin-top: 1.5rem;
            width: 100%;
            padding: 10px;
            background: transparent;
            border: 1px solid ${region.color};
            color: ${region.color};
            border-radius: 12px;
            cursor: pointer;
            font-size: 0.9rem;
        ">Close</button>
    `;
    tooltip.style.borderColor = region.color;
    tooltip.style.boxShadow = `0 0 60px ${region.color}40`;
}

export function renderMap(regions, entries = []) {
    regionsGroup.innerHTML = '';
    labelsGroup.innerHTML = '';
    bridgesGroup.innerHTML = '';
    currentRegions = regions;

    // Make data available globally for tooltips
    window.AppData = { regions, entries };

    const regionList = Object.values(regions);

    // Draw curved bridges with glow
    regionList.forEach((r1, i) => {
        regionList.slice(i + 1).forEach(r2 => {
            const dist = Math.sqrt(Math.pow(r1.x - r2.x, 2) + Math.pow(r1.y - r2.y, 2));
            if (dist < 400) {
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                const midX = (r1.x + r2.x) / 2;
                const midY = (r1.y + r2.y) / 2;
                const offset = seededRandom(i * 50 + r1.x) * 60 - 30;

                path.setAttribute("d", `M ${r1.x},${r1.y} Q ${midX + offset},${midY + offset} ${r2.x},${r2.y}`);
                path.setAttribute("stroke", "rgba(255, 166, 77, 0.25)");
                path.setAttribute("stroke-width", "2");
                path.setAttribute("fill", "none");
                path.setAttribute("stroke-dasharray", "8,6");
                path.style.filter = "blur(1px)";
                bridgesGroup.appendChild(path);
            }
        });
    });

    // Draw regions with vibrant colors and glow
    regionList.forEach((region, index) => {
        if (region.size <= 0) return;

        const filterId = createGlowFilter(region.id, region.color);
        const gradId = createRadialGradient(region.id, region.color, region.intensity);
        const seed = region.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);

        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "region-node");
        g.style.cursor = "pointer";
        g.style.transition = "transform 0.3s ease";

        // Main blob with gradient fill
        const mainBlob = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const blobPath = createBlobPath(region.x, region.y, region.size, seed);
        mainBlob.setAttribute("d", blobPath);
        mainBlob.setAttribute("fill", `url(#${gradId})`);
        mainBlob.setAttribute("stroke", region.color);
        mainBlob.setAttribute("stroke-width", "3");
        mainBlob.setAttribute("filter", `url(#${filterId})`);
        mainBlob.style.transition = "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)";

        // Ambient pulse animation
        const animateOpacity = document.createElementNS("http://www.w3.org/2000/svg", "animate");
        animateOpacity.setAttribute("attributeName", "stroke-opacity");
        animateOpacity.setAttribute("values", "1;0.5;1");
        animateOpacity.setAttribute("dur", `${3 + seededRandom(seed) * 2}s`);
        animateOpacity.setAttribute("repeatCount", "indefinite");
        mainBlob.appendChild(animateOpacity);

        // Label
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", region.x);
        label.setAttribute("y", region.y + 5);
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("fill", "white");
        label.setAttribute("font-size", Math.max(14, region.size / 4));
        label.setAttribute("font-weight", "600");
        label.setAttribute("font-family", "Outfit, sans-serif");
        label.style.textShadow = `0 0 20px ${region.color}, 0 2px 10px rgba(0,0,0,0.8)`;
        label.style.pointerEvents = "none";
        label.textContent = region.name;

        // Hover effects
        g.onmouseenter = () => {
            mainBlob.setAttribute("stroke-width", "5");
            mainBlob.style.filter = `url(#${filterId}) drop-shadow(0 0 25px ${region.color})`;
            g.style.transform = "scale(1.08)";
            g.style.transformOrigin = `${region.x}px ${region.y}px`;
        };

        g.onmouseleave = () => {
            mainBlob.setAttribute("stroke-width", "3");
            mainBlob.style.filter = `url(#${filterId})`;
            g.style.transform = "scale(1)";
        };

        // Click to show details
        g.onclick = (e) => {
            e.stopPropagation();
            showRegionDetails(region);
        };

        g.appendChild(mainBlob);
        regionsGroup.appendChild(g);
        labelsGroup.appendChild(label);
    });
}

// Add CSS animation for tooltip
const style = document.createElement('style');
style.textContent = `
    @keyframes tooltipFadeIn {
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
`;
document.head.appendChild(style);
