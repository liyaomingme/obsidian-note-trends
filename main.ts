import { App, ItemView, Plugin, WorkspaceLeaf, Notice, Modal, TFile, setIcon } from 'obsidian';

const VIEW_TYPE_STATS_HEATMAP = "desktop-stats-heatmap-view";

// --- 深度清洗过滤库 ---
const STOP_WORDS = new Set([
    'the', 'and', 'for', 'that', 'this', 'with', 'from', 'https', 'com', 'org', 
    'www', 'are', 'can', 'not', 'you', 'your', 'have', 'was', 'but', 'all', 
    'what', 'http', 'html', 'file', 'png', 'jpg', 'out', 'has', 'will', 'use',
    'which', 'when', 'more', 'about', 'their', 'there', 'some', '因此', '通过',
    '可以', '一个', '没有', '我们', '什么', '这个', '如果是', '怎么', '如果',
    '可以说', '这样', '很多', '非常', '进行', '然后', '可能', '因为', '所以',
    '各位', '谢谢', '由于', '其实', '只要', '目前', '开始'
]);

// --- 终极架构：DOM + Canvas 混合 3D 星系连线引擎 ---
class WordSphereEngine {
    container: HTMLElement;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    radius: number;
    width: number;
    height: number;
    tags: { el: HTMLElement, x: number, y: number, z: number, theta: number, phi: number, baseFontSize: number, baseWeight: string, renderState: string }[] = [];
    isStopped = false;
    isHoveringNode = false; 
    mouseX = 0; mouseY = 0;
    lastMouseX = 0; lastMouseY = 0;
    damping = 0.95; 
    animationFrameId: number;
    isActive = true;
    resizeObserver: ResizeObserver;

    constructor(container: HTMLElement, radius: number) {
        this.container = container;
        this.radius = radius;
        
        // 1. 初始化 Canvas 层 (永远处于底层，不阻挡鼠标点击文字)
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none'; // 核心：鼠标事件穿透
        this.canvas.style.zIndex = '0';
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d')!;

        this.handleResize();
        this.setupMouseListeners();

        // 监听容器大小变化，保持 Retina 屏幕的高清连线
        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(this.container);
    }

    private handleResize() {
        const rect = this.container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.width = rect.width;
        this.height = rect.height;
    }

    addTag(tagEl: HTMLElement, baseFontSize: number, baseWeight: string) {
        tagEl.style.position = 'absolute';
        tagEl.style.cursor = 'pointer';
        tagEl.style.willChange = 'transform, opacity, filter';
        tagEl.style.zIndex = '10'; // 确保文字在连线之上
        
        const count = this.tags.length;
        const offset = 2 / 50; 
        const increment = Math.PI * (3 - Math.sqrt(5));
        const y = ((count * offset) - 1) + (offset / 2);
        const r = Math.sqrt(1 - y * y);
        const phi = (count % 50) * increment;
        
        this.tags.push({
            el: tagEl,
            x: Math.cos(phi) * r * this.radius,
            y: y * this.radius,
            z: Math.sin(phi) * r * this.radius,
            theta: Math.atan2(Math.sin(phi) * r * this.radius, Math.cos(phi) * r * this.radius),
            phi: Math.acos(y),
            baseFontSize,
            baseWeight,
            renderState: 'normal' // 用于交互状态追踪
        });
        
        this.container.appendChild(tagEl);
    }

    private setupMouseListeners() {
        this.container.addEventListener('mousemove', (e) => {
            const rect = this.container.getBoundingClientRect();
            this.mouseX = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
            this.mouseY = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
        });
        this.container.addEventListener('mouseenter', () => this.isStopped = false);
        this.container.addEventListener('mouseleave', () => this.isStopped = true);
    }

    startAnimation() {
        if (this.tags.length === 0) return;
        
        let targetRotationX = 0; let targetRotationY = 0;
        let currentRotationX = 0; let currentRotationY = 0;

        this.container.addEventListener('mousemove', () => {
            targetRotationY += (this.mouseX - this.lastMouseX) * 0.08;
            targetRotationX += (this.mouseY - this.lastMouseY) * 0.08;
            this.lastMouseX = this.mouseX;
            this.lastMouseY = this.mouseY;
        });

        // 动态获取 Obsidian 的文字颜色用于绘制连线与原点
        const getComputedColor = (cssVar: string, fallback: string) => {
            const val = getComputedStyle(document.body).getPropertyValue(cssVar).trim();
            return val || fallback;
        };

        const animate = () => {
            if (!this.isActive) return;

            let baseSpeedX = 0.001; 
            let baseSpeedY = 0.0015;

            if (!this.isStopped && !this.isHoveringNode) {
                currentRotationX += (targetRotationX - currentRotationX) * 0.05;
                currentRotationY += (targetRotationY - currentRotationY) * 0.05;
                targetRotationX *= this.damping;
                targetRotationY *= this.damping;
                baseSpeedX += currentRotationX;
                baseSpeedY += currentRotationY;
            }

            this.ctx.clearRect(0, 0, this.width, this.height);
            const cx = this.width / 2;
            const cy = this.height / 2;

            // 读取主题颜色
            const colorAccent = getComputedColor('--interactive-accent', '#007AFF');
            const colorNormal = getComputedColor('--text-normal', '#333333');
            const neutralLineColor = '128, 128, 128'; // 万能灰色基底，适应深浅色模式

            // 计算所有节点的三维坐标并按 Z 轴深度排序，保证连线与原点的绝对正确遮挡关系
            const renderList = this.tags.map(tag => {
                if (!this.isHoveringNode) {
                    const x1 = tag.x * Math.cos(baseSpeedY) - tag.z * Math.sin(baseSpeedY);
                    const z1 = tag.z * Math.cos(baseSpeedY) + tag.x * Math.sin(baseSpeedY);
                    const y1 = tag.y * Math.cos(baseSpeedX) - z1 * Math.sin(baseSpeedX);
                    const z2 = z1 * Math.cos(baseSpeedX) + tag.y * Math.sin(baseSpeedX);
                    tag.x = x1; tag.y = y1; tag.z = z2;
                }
                return { ...tag, zRatio: tag.z / this.radius };
            }).sort((a, b) => a.z - b.z);

            // ===============================================
            // 步骤 1：绘制处于背景的连线 (Z < 0)
            // ===============================================
            renderList.forEach(item => {
                if (item.z >= 0) return;
                this.drawConnectionLine(cx, cy, item, neutralLineColor, colorNormal, colorAccent);
            });

            // ===============================================
            // 步骤 2：绘制中心奇点 (原点) 
            // 夹在前后连线之间，产生极强的立体穿透感
            // ===============================================
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
            this.ctx.fillStyle = colorNormal;
            this.ctx.fill();
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = 'rgba(128,128,128,0.5)';
            this.ctx.shadowBlur = 0; // 重置

            // ===============================================
            // 步骤 3：绘制处于前景的连线 (Z >= 0)
            // ===============================================
            renderList.forEach(item => {
                if (item.z < 0) return;
                this.drawConnectionLine(cx, cy, item, neutralLineColor, colorNormal, colorAccent);
            });

            // ===============================================
            // 步骤 4：更新所有 DOM 文本节点的状态与景深
            // ===============================================
            renderList.forEach(item => {
                const tag = item;
                if (this.isHoveringNode) {
                    // 聚光灯交互状态
                    if (tag.renderState === 'focused') {
                        tag.el.style.opacity = '1';
                        tag.el.style.filter = 'blur(0px)';
                        tag.el.style.transform = `translate3d(${cx + tag.x - tag.el.offsetWidth/2}px, ${cy + tag.y - tag.el.offsetHeight/2}px, 0px) scale(1.15)`;
                        tag.el.style.zIndex = '99999';
                        tag.el.style.color = 'var(--text-normal)';
                        tag.el.style.textShadow = '0 8px 24px rgba(0,0,0,0.1)';
                    } else if (tag.renderState === 'co-occurring') {
                        tag.el.style.opacity = '0.5';
                        tag.el.style.filter = 'blur(0px)';
                        tag.el.style.transform = `translate3d(${cx + tag.x - tag.el.offsetWidth/2}px, ${cy + tag.y - tag.el.offsetHeight/2}px, 0px) scale(1)`;
                        tag.el.style.zIndex = '50000';
                        tag.el.style.color = 'var(--text-muted)';
                        tag.el.style.textShadow = 'none';
                    } else {
                        tag.el.style.opacity = '0.04';
                        tag.el.style.filter = `blur(6px)`;
                        tag.el.style.transform = `translate3d(${cx + tag.x - tag.el.offsetWidth/2}px, ${cy + tag.y - tag.el.offsetHeight/2}px, 0px) scale(0.9)`;
                        tag.el.style.zIndex = '10';
                        tag.el.style.color = 'var(--text-faint)';
                        tag.el.style.textShadow = 'none';
                    }
                } else {
                    // 原生 Z 轴景深状态
                    let opacity = 0; let blur = 0;
                    if (item.zRatio > 0.4) {
                        opacity = 0.9; blur = 0;
                        tag.el.style.color = 'var(--text-normal)'; 
                    } else if (item.zRatio > 0) {
                        opacity = 0.4 + 0.5 * (item.zRatio / 0.4); blur = 0;
                        tag.el.style.color = 'var(--text-muted)'; 
                    } else {
                        opacity = 0.05 + 0.2 * ((item.zRatio + 1) / 1); 
                        blur = Math.min(3.5, Math.abs(item.zRatio) * 3.5); 
                        tag.el.style.color = 'var(--text-faint)';
                    }

                    const scale = (this.radius + tag.z) / (2 * this.radius); 
                    const finalScale = 0.6 + 0.55 * scale; 

                    tag.el.style.transform = `translate3d(${cx + tag.x - tag.el.offsetWidth/2}px, ${cy + tag.y - tag.el.offsetHeight/2}px, 0px) scale(${finalScale})`;
                    tag.el.style.opacity = opacity.toString();
                    tag.el.style.filter = `blur(${blur}px)`;
                    tag.el.style.zIndex = Math.round(tag.z + this.radius).toString();
                }
            });

            this.animationFrameId = requestAnimationFrame(animate);
        };

        animate();
    }

    // Canvas 画线逻辑：完美遵循景深规律，极度克制
    private drawConnectionLine(cx: number, cy: number, item: any, neutralRGB: string, normalColor: string, accentColor: string) {
        let lineOpacity = 0;
        let lineWidth = 0.5;
        let strokeStyle = `rgba(${neutralRGB}, `;

        if (this.isHoveringNode) {
            if (item.renderState === 'focused') {
                lineOpacity = 0.3; // 聚焦节点连线加粗提亮
                lineWidth = 1.2;
                strokeStyle = normalColor; // 使用实色
            } else if (item.renderState === 'co-occurring') {
                lineOpacity = 0.15; // 关联节点隐约亮起
                lineWidth = 0.8;
                strokeStyle = `rgba(${neutralRGB}, `;
            } else {
                lineOpacity = 0; // 无关节点连线彻底消失，保持绝对干净
            }
        } else {
            // 常态旋转下的景深线
            if (item.zRatio > 0) {
                lineOpacity = 0.02 + 0.12 * item.zRatio; // 前景极其微弱的连线，防止干扰阅读
                lineWidth = 0.5 + 0.5 * item.zRatio;
            } else {
                lineOpacity = 0.02 * (1 - Math.abs(item.zRatio)); // 背景连线几乎隐形
                lineWidth = 0.5;
            }
        }

        if (lineOpacity <= 0) return;

        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy);
        this.ctx.lineTo(cx + item.x, cy + item.y);
        this.ctx.strokeStyle = strokeStyle.includes('rgba') ? `${strokeStyle}${lineOpacity})` : strokeStyle;
        this.ctx.lineWidth = lineWidth;
        this.ctx.stroke();
    }

    destroy() {
        this.isActive = false;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.resizeObserver.disconnect();
    }
}

// --- 数据分析引擎 ---
async function analyzeVaultData(app: App) {
    const files = app.vault.getMarkdownFiles();
    const wordData = new Map<string, { count: number, files: Set<TFile> }>();

    for (const file of files) {
        const content = await app.vault.cachedRead(file);
        const cleanText = content
            .replace(/```[\s\S]*?```/g, '') 
            .replace(/---[\s\S]*?---/, '')  
            .replace(/[#*`>\[\]()]/g, '');  

        const words = cleanText.match(/[\u4e00-\u9fa5]{2,}|\b[a-zA-Z]{3,}\b/g) || [];
        for (const word of words) {
            const w = word.toLowerCase();
            if (!STOP_WORDS.has(w)) {
                if (!wordData.has(w)) { wordData.set(w, { count: 0, files: new Set() }); }
                const entry = wordData.get(w)!;
                entry.count++;
                entry.files.add(file);
            }
        }
    }

    return Array.from(wordData.entries())
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 45) // 保持 45 个核心神经元，让连线拓扑图极具呼吸感
                .map(([word, data]) => ({ word, value: data.count, files: Array.from(data.files) }));
}

// --- 沉浸式上下文溯源 Modal ---
class WordContextModal extends Modal {
    word: string; files: TFile[];
    constructor(app: App, word: string, files: TFile[]) { super(app); this.word = word; this.files = files; }

    async onOpen() {
        const { contentEl } = this; contentEl.empty();
        this.modalEl.style.cssText = 'max-width: 850px; width: 90vw; border-radius: 24px; padding: 40px; box-shadow: 0 24px 60px rgba(0,0,0,0.06);';

        contentEl.createEl('h2', { text: `「${this.word}」`, attr: { style: 'margin: 0 0 10px 0; font-size: 2em; font-weight: 850; color: var(--interactive-accent); font-family: "SF Pro Display", "PingFang SC", sans-serif; letter-spacing: -0.5px;' } });
        contentEl.createEl('p', { text: `在 ${this.files.length} 篇笔记的正文中被提及：`, attr: { style: 'margin: 0 0 28px 0; color: var(--text-muted); font-size: 1.1em;' } });

        const listContainer = contentEl.createDiv({ attr: { style: 'max-height: 62vh; overflow-y: auto; padding-right: 15px; display: flex; flex-direction: column; gap: 20px;' } });

        this.files.forEach(async (file) => {
            const content = await this.app.vault.cachedRead(file);
            const rawContent = content.replace(/\s+/g, ' '); 
            const safeWord = this.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
            const regex = new RegExp(`.{0,45}${safeWord}.{0,45}`, 'gi');
            const matches = rawContent.match(regex) || [];

            if (matches.length > 0) {
                const card = listContainer.createDiv({ attr: { style: 'background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 16px; padding: 20px; cursor: pointer; transition: all 0.2s ease;' } });
                card.addEventListener('mouseenter', () => { card.style.borderColor = 'var(--interactive-accent)'; card.style.transform = 'translateY(-3px)'; card.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.04)'; });
                card.addEventListener('mouseleave', () => { card.style.borderColor = 'var(--background-modifier-border)'; card.style.transform = 'translateY(0)'; card.style.boxShadow = 'none'; });
                card.addEventListener('click', async () => { const leaf = this.app.workspace.getLeaf(false); await leaf.openFile(file); this.close(); });

                const fileTitle = card.createEl('div', { attr: { style: 'font-weight: 800; font-size: 1.25em; margin-bottom: 16px; color: var(--text-normal); font-family: "SF Pro Text", "PingFang SC", sans-serif; display: flex; align-items: center;' } });
                const fileIconSpan = fileTitle.createEl('span', { attr: { style: 'margin-right: 8px; opacity: 0.7;' } });
                setIcon(fileIconSpan, 'document'); fileTitle.appendChild(document.createTextNode(file.basename));

                const displayMatches = matches.slice(0, 3);
                for (let match of displayMatches) {
                    const snippetDiv = card.createDiv({ attr: { style: 'font-size: 1em; color: var(--text-muted); line-height: 1.6; margin-bottom: 12px; background: var(--background-primary); padding: 10px 16px; border-radius: 10px;' } });
                    const parts = match.split(new RegExp(`(${safeWord})`, 'gi'));
                    snippetDiv.appendChild(document.createTextNode('"...'));
                    parts.forEach(part => {
                        if (part.toLowerCase() === this.word.toLowerCase()) {
                            snippetDiv.createEl('span', { text: part, attr: { style: 'color: #fff; background-color: var(--interactive-accent); padding: 2px 6px; border-radius: 6px; font-weight: bold; margin: 0 2px;' } });
                        } else { snippetDiv.appendChild(document.createTextNode(part)); }
                    });
                    snippetDiv.appendChild(document.createTextNode('..."'));
                }
            }
        });
    }
    onClose() { this.contentEl.empty(); }
}

// --- 桌面端视图 ---
class DesktopStatsHeatmapView extends ItemView {
    sphereEngine: WordSphereEngine | null = null;
    
    constructor(leaf: WorkspaceLeaf) { super(leaf); }
    getViewType() { return VIEW_TYPE_STATS_HEATMAP; }
    getDisplayText() { return "神经元拓扑网络"; }
    getIcon() { return "network"; } // 更换为网络节点图标

    async onOpen() {
        const container = this.containerEl.children[1]; container.empty();
        container.addClass('stats-heatmap-dashboard-container');

        container.setAttr('style', `
            padding: 40px; display: flex; flex-direction: column; height: 100%; overflow: hidden; 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif;
            -webkit-font-smoothing: antialiased; background-color: var(--background-secondary);
        `);

        const headerDiv = container.createDiv({ attr: { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-shrink: 0;' } });
        headerDiv.createEl("h2", { text: "神经元拓扑网络", attr: { style: 'margin: 0; font-size: 1.7em; font-weight: 800; letter-spacing: -0.5px;' } });
        const refreshBtn = headerDiv.createEl("button", { text: "重构突触", attr: { style: 'padding: 8px 20px; cursor: pointer; background-color: var(--interactive-accent); color: var(--text-on-accent); border-radius: 20px; border: none; font-size: 0.9em; font-weight: 500;' } });
        
        const contentWrapper = container.createDiv({ attr: { style: 'display: flex; flex-direction: column; flex: 1; min-height: 0;' } });
        const heatmapDiv = contentWrapper.createDiv({ 
            attr: { style: 'flex: 1; display: flex; justify-content: center; align-items: center; background-color: var(--background-primary); border-radius: 24px; box-shadow: 0 16px 48px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.02); overflow: hidden; position: relative;' } 
        });

        const renderData = async () => {
            refreshBtn.innerText = "突触建立中..."; refreshBtn.disabled = true;
            if (this.sphereEngine) this.sphereEngine.destroy();
            heatmapDiv.empty();
            
            const heatmapWords =
