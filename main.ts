import { App, ItemView, Plugin, WorkspaceLeaf, Notice, Modal, TFile, setIcon } from 'obsidian';

const VIEW_TYPE_STATS_HEATMAP = "desktop-stats-heatmap-view";

// --- 深度清洗过滤库 (加入更多中文常用虚词，保持数据精准) ---
const STOP_WORDS = new Set([
    'the', 'and', 'for', 'that', 'this', 'with', 'from', 'https', 'com', 'org', 
    'www', 'are', 'can', 'not', 'you', 'your', 'have', 'was', 'but', 'all', 
    'what', 'http', 'html', 'file', 'png', 'jpg', 'out', 'has', 'will', 'use',
    'which', 'when', 'more', 'about', 'their', 'there', 'some', '因此', '通过',
    '可以', '一个', '没有', '我们', '什么', '这个', '如果是', '怎么', '如果',
    '可以说', '这样', '很多', '非常', '进行', '然后', '可能', '因为', '所以',
    '各位', '谢谢', '由于', '其实', '只要', '目前', '开始'
]);

// --- 核心新架构：Web-Spherical 3D 星系引擎 ---
class WordSphereEngine {
    container: HTMLElement;
    radius: number;
    tags: { el: HTMLElement, x: number, y: number, z: number, theta: number, phi: number }[] = [];
    isStopped = false;
    mouseX = 0;
    mouseY = 0;
    lastMouseX = 0;
    lastMouseY = 0;
    damping = 0.95; 

    constructor(container: HTMLElement, radius: number) {
        this.container = container;
        this.radius = radius;
        this.setupMouseListeners();
    }

    addTag(tagEl: HTMLElement) {
        tagEl.style.position = 'absolute';
        tagEl.style.cursor = 'pointer';
        tagEl.style.willChange = 'transform, opacity';
        
        const count = this.tags.length;
        // 计算菲波那契球体均匀分布点 (确保大词不挤，小词不散)
        const offset = 2 / (50); // 最优密度为 50 个词以内
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
            phi: Math.acos(y)
        });
        
        this.container.appendChild(tagEl);
    }

    private setupMouseListeners() {
        this.container.addEventListener('mousemove', (e) => {
            const rect = this.container.getBoundingClientRect();
            // 计算鼠标相对于容器中心点的偏移比例
            this.mouseX = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
            this.mouseY = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
        });
        
        this.container.addEventListener('mouseenter', () => this.isStopped = false);
        this.container.addEventListener('mouseleave', () => this.isStopped = true);
    }

    // 核心动画算法：一休止平滑转动 + 景深算法
    startAnimation() {
        if (this.tags.length === 0) return;
        
        let targetRotationX = 0;
        let targetRotationY = 0;
        let currentRotationX = 0;
        let currentRotationY = 0;

        // 核心惯性滑动算法：鼠标移动改变目标旋转角度
        this.container.addEventListener('mousemove', (e) => {
            targetRotationY += (this.mouseX - this.lastMouseX) * 0.08;
            targetRotationX += (this.mouseY - this.lastMouseY) * 0.08;
            this.lastMouseX = this.mouseX;
            this.lastMouseY = this.mouseY;
        });

        const animate = () => {
            // 基础自转速度（极低，保持呼吸感）
            let baseSpeedX = 0.001; 
            let baseSpeedY = 0.0015;

            if (!this.isStopped) {
                // 应用鼠标惯性滑动
                currentRotationX += (targetRotationX - currentRotationX) * 0.05;
                currentRotationY += (targetRotationY - currentRotationY) * 0.05;
                targetRotationX *= this.damping;
                targetRotationY *= this.damping;
                baseSpeedX += currentRotationX;
                baseSpeedY += currentRotationY;
            }

            // 更新每个词的三维坐标与景深样式
            this.tags.forEach(tag => {
                // 三维球体坐标变换
                const x1 = tag.x * Math.cos(baseSpeedY) - tag.z * Math.sin(baseSpeedY);
                const z1 = tag.z * Math.cos(baseSpeedY) + tag.x * Math.sin(baseSpeedY);
                const y1 = tag.y * Math.cos(baseSpeedX) - z1 * Math.sin(baseSpeedX);
                const z2 = z1 * Math.cos(baseSpeedX) + tag.y * Math.sin(baseSpeedX);
                
                tag.x = x1;
                tag.y = y1;
                tag.z = z2;

                // 景深算法 (Perspective & Depth of Field)
                const perspective = (z2 + this.radius) / (2 * this.radius);
                // 彻底取消之前的颜色渐变，改为原生高级景深处理
                const opacity = 0.08 + (0.92 * perspective); 
                const scale = 0.75 + (0.25 * perspective);
                // 高级景深虚化：无关词汇根据远近进行虚化处理
                const blur = z2 < 0 ? Math.abs(z2) / this.radius * 2 : 0; 
                
                // 应用三维变换样式
                tag.el.style.transform = `translate3d(${tag.x}px, ${tag.y}px, ${z2}px) scale(${scale})`;
                tag.el.style.opacity = opacity.toString();
                // 在浅色模式下应用高级景深虚化
                tag.el.style.filter = `blur(${blur}px)`;
                // 确保大词不拧，大圆角卡片质感
                tag.el.style.borderRadius = '16px'; 
                tag.el.style.zIndex = Math.round(z2 + this.radius).toString();
            });

            requestAnimationFrame(animate);
        };

        animate();
    }
}

// --- 深度数据分析引擎 (追踪文件来源) ---
async function analyzeVaultData(app: App) {
    const files = app.vault.getMarkdownFiles();
    const wordData = new Map<string, { count: number, files: Set<TFile> }>();

    for (const file of files) {
        const content = await app.vault.cachedRead(file);
        // 极速提纯内容，忽略代码块、YAML、Markdown符号
        const cleanText = content
            .replace(/```[\s\S]*?```/g, '') 
            .replace(/---[\s\S]*?---/, '')  
            .replace(/[#*`>\[\]()]/g, '');  

        // 匹配 2 个以上的中文字符或 3 个以上的英文字符
        const words = cleanText.match(/[\u4e00-\u9fa5]{2,}|\b[a-zA-Z]{3,}\b/g) || [];
        for (const word of words) {
            const w = word.toLowerCase();
            if (!STOP_WORDS.has(w)) {
                if (!wordData.has(w)) {
                    wordData.set(w, { count: 0, files: new Set() });
                }
                const entry = wordData.get(w)!;
                entry.count++;
                entry.files.add(file);
            }
        }
    }

    return Array.from(wordData.entries())
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 48) // 缩减到 Top 48，大词更饱满，留白更高级
                .map(([word, data]) => ({ word, value: data.count, files: Array.from(data.files) }));
}

// --- 沉浸式上下文溯源 Modal ---
class WordContextModal extends Modal {
    word: string;
    files: TFile[];

    constructor(app: App, word: string, files: TFile[]) {
        super(app);
        this.word = word;
        this.files = files;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        this.modalEl.style.maxWidth = '850px';
        this.modalEl.style.width = '90vw';
        this.modalEl.style.borderRadius = '24px';
        this.modalEl.style.padding = '40px';
        this.modalEl.style.boxShadow = '0 24px 60px rgba(0,0,0,0.06)';

        contentEl.createEl('h2', { 
            text: `「${this.word}」`,
            attr: { style: 'margin: 0 0 10px 0; font-size: 2em; font-weight: 850; color: var(--interactive-accent); font-family: "SF Pro Display", "PingFang SC", sans-serif; letter-spacing: -0.5px;' }
        });
        contentEl.createEl('p', {
            text: `在 ${this.files.length} 篇笔记的正文中被提及：`,
            attr: { style: 'margin: 0 0 28px 0; color: var(--text-muted); font-size: 1.1em;' }
        });

        const listContainer = contentEl.createDiv({
            attr: { style: 'max-height: 62vh; overflow-y: auto; padding-right: 15px; display: flex; flex-direction: column; gap: 20px;' }
        });

        this.files.forEach(async (file) => {
            const content = await this.app.vault.cachedRead(file);
            const rawContent = content.replace(/\s+/g, ' '); 
            const safeWord = this.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
            const regex = new RegExp(`.{0,45}${safeWord}.{0,45}`, 'gi');
            const matches = rawContent.match(regex) || [];

            if (matches.length > 0) {
                const card = listContainer.createDiv({
                    attr: { style: 'background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 16px; padding: 20px; cursor: pointer; transition: all 0.2s ease;' }
                });
                
                card.addEventListener('mouseenter', () => {
                    card.style.borderColor = 'var(--interactive-accent)';
                    card.style.transform = 'translateY(-3px)';
                    card.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.04)';
                });
                card.addEventListener('mouseleave', () => {
                    card.style.borderColor = 'var(--background-modifier-border)';
                    card.style.transform = 'translateY(0)';
                    card.style.boxShadow = 'none';
                });

                card.addEventListener('click', async () => {
                    const leaf = this.app.workspace.getLeaf(false);
                    await leaf.openFile(file);
                    this.close(); 
                });

                const fileTitle = card.createEl('div', {
                    attr: { style: 'font-weight: 800; font-size: 1.25em; margin-bottom: 16px; color: var(--text-normal); font-family: "SF Pro Text", "PingFang SC", sans-serif; display: flex; align-items: center;' }
                });
                const fileIconSpan = fileTitle.createEl('span', { attr: { style: 'margin-right: 8px; opacity: 0.7;' } });
                setIcon(fileIconSpan, 'document');
                fileTitle.appendChild(document.createTextNode(file.basename));

                const displayMatches = matches.slice(0, 3);
                for (let match of displayMatches) {
                    const snippetDiv = card.createDiv({ attr: { style: 'font-size: 1em; color: var(--text-muted); line-height: 1.6; margin-bottom: 12px; background: var(--background-primary); padding: 10px 16px; border-radius: 10px;' } });
                    const parts = match.split(new RegExp(`(${safeWord})`, 'gi'));
                    snippetDiv.appendChild(document.createTextNode('"...'));
                    parts.forEach(part => {
                        if (part.toLowerCase() === this.word.toLowerCase()) {
                            const span = snippetDiv.createEl('span', { text: part, attr: { style: 'color: #fff; background-color: var(--interactive-accent); padding: 2px 6px; border-radius: 6px; font-weight: bold; margin: 0 2px;' } });
                        } else {
                            snippetDiv.appendChild(document.createTextNode(part));
                        }
                    });
                    snippetDiv.appendChild(document.createTextNode('..."'));
                }
            }
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}

// --- 桌面端视图 ---
class DesktopStatsHeatmapView extends ItemView {
    sphereEngine: WordSphereEngine;
    
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() { return VIEW_TYPE_STATS_HEATMAP; }
    getDisplayText() { return "知识资产热力全景"; }
    getIcon() { return "activity"; } // 更换为具有动态感知的图标

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('stats-heatmap-dashboard-container');

        // 应用高分辨率全屏铺满 CSS，去除繁琐的边距，贴合原生质感
        container.setAttr('style', `
            padding: 40px;
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow: hidden; // 确保 3D 球体不溢出
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif;
            -webkit-font-smoothing: antialiased;
            background-color: var(--background-secondary);
        `);

        // 极简顶部标题（去掉下划线，完全留白）
        const headerDiv = container.createDiv({ attr: { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-shrink: 0;' } });
        headerDiv.createEl("h2", { text: "知识资产热力全景", attr: { style: 'margin: 0; font-size: 1.7em; font-weight: 800; letter-spacing: -0.5px;' } });
        const refreshBtn = headerDiv.createEl("button", { text: "重新扫描神经元", attr: { style: 'padding: 8px 20px; cursor: pointer; background-color: var(--interactive-accent); color: var(--text-on-accent); border-radius: 20px; border: none; font-size: 0.9em; font-weight: 500;' } });
        
        const contentWrapper = container.createDiv({ attr: { style: 'display: flex; flex-direction: column; flex: 1; min-height: 0;' } });

        // 关键重构：核心原生态 3D 球体容器 (极致留白呼吸感)
        const heatmapDiv = contentWrapper.createDiv({ 
            attr: { style: 'flex: 1; display: flex; justify-content: center; align-items: center; background-color: var(--background-primary); border-radius: 24px; box-shadow: 0 16px 48px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.02);' } 
        });
        
        // 核心原生态球体画布 (开启透视视距)
        const sphereCanvas = heatmapDiv.createDiv({ 
            attr: { style: 'width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; position: relative; perspective: 1500px;' } 
        });

        const renderData = async () => {
            refreshBtn.innerText = "神经元捕捉中...";
            refreshBtn.disabled = true;
            sphereCanvas.empty();
            
            const heatmapWords = await analyzeVaultData(this.app);
            const maxWordCount = heatmapWords.length > 0 ? heatmapWords[0].value : 1;

            // 菲波那契球体均匀分布点半径计算，确保大卡片质感
            const baseRadius = Math.min(heatmapDiv.clientWidth, heatmapDiv.clientHeight) / 2 - 120;
            const engine = new WordSphereEngine(sphereCanvas, baseRadius);

            heatmapWords.forEach(({word, value, files}) => {
                const wordEl = document.createElement('div');
                wordEl.innerText = word;
                
                // 彻底取消之前的颜色渐变，统一使用苹果原生态经典蓝 (0, 122, 255)
                const baseColor = 'rgba(0, 122, 255, 1)';
                
                // 强制应用 SF Pro 显示黑体，增加视觉饱满度
                // 彻底去除圆角，恢复锐利的卡片质感，大词号，增加景深信息
                wordEl.setAttr("style", `
                    color: ${baseColor}; 
                    font-size: ${Math.max(14, Math.min(60, 14 + (value/maxWordCount)*46))}px;
                    font-weight: 850;
                    letter-spacing: -0.5px;
                    padding: 8px 16px;
                    border-radius: 0px; // 去除圆角
                    background-color: var(--background-primary); // 增加底层白色，使景深模糊更高级
                    border: 0px; // 去除描边
                    user-select: none;
                `);
                
                // 鼠标交互保持原本逻辑：点击呼出防崩溃 Modal
                wordEl.addEventListener('click', () => {
                    new WordContextModal(this.app, word, files).open();
                });
                
                // 3D 联动交互逻辑：聚光灯聚焦当前神经元及其共现关联
                wordEl.addEventListener('mouseenter', () => {
                    engine.isStopped = true; // 停止自转
                    const targetFilePaths = new Set(files.map(f => f.path));
                    
                    engine.tags.forEach(tag => {
                        let isCoOccurring = false;
                        tag.el.setAttribute('data-target-paths', '').split(',').forEach(p => {
                            if (p && targetFilePaths.has(p)) {
                                isCoOccurring = true;
                                return;
                            }
                        });

                        if (tag.el === wordEl) {
                            // 当前神经元：最大化聚焦，景深置顶
                            tag.el.style.opacity = '1';
                            tag.el.style.filter = 'blur(0px)';
                            tag.el.style.transform = `${tag.el.style.transform.split(' scale')[0]} scale(1.1) translateZ(${baseRadius + 50}px)`; // 置顶景深
                            tag.el.style.zIndex = '9999';
                            tag.el.style.textShadow = '0 12px 24px rgba(0, 122, 255, 0.4)';
                        } else if (isCoOccurring) {
                            // 共现关联神经元：亮起，景深清晰
                            tag.el.style.opacity = '0.9';
                            tag.el.style.filter = 'blur(0px)';
                            tag.el.style.textShadow = 'none';
                        } else {
                            // 无关神经元：深海景深虚化
                            tag.el.style.opacity = '0.05';
                            tag.el.style.filter = `blur(12px)`;
                            tag.el.style.textShadow = 'none';
                        }
                    });
                });
                
                wordEl.addEventListener('mouseleave', () => {
                    engine.isStopped = false; // 恢复自转
                });
                
                // 将共现文件的路径挂载在 DOM 上，用于 3D 聚光灯联动计算
                wordEl.setAttribute('data-target-paths', files.map(f => f.path).join(','));
                
                // 核心重构：彻底移除了 ID 绑定，采用无冲突的 DOM 对象传递方式
                engine.addTag(wordEl);
            });

            engine.startAnimation();
            refreshBtn.innerText = "重新扫描神经元";
            refreshBtn.disabled = false;
        };

        refreshBtn.addEventListener('click', renderData);
        setTimeout(renderData, 150); 
    }
}

// --- 插件主入口 ---
export default class DesktopStatsPlugin extends Plugin {
    async onload() {
        this.registerView(VIEW_TYPE_STATS_HEATMAP, (leaf) => new DesktopStatsHeatmapView(leaf));
        
        // 此图标也同步更换为具有动态感知的图标
        this.addRibbonIcon('activity', '打开知识资产热力全景', () => {
            this.activateView();
        });

        this.addCommand({
            id: 'open-heatmap-dashboard',
            name: '打开知识资产热力全景',
            callback: () => {
                this.activateView();
            }
        });
    }

    async onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_STATS_HEATMAP);
    }

    async activateView() {
        const { workspace } = this.app;
        
        let existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_STATS_HEATMAP);
        for (let i = 0; i < existingLeaves.length; i++) {
            existingLeaves[i].detach(); // 安全清理所有的旧视图，彻底封杀崩溃可能
        }

        const leaf = workspace.getRightLeaf(false);
        if (leaf) {
            await leaf.setViewState({ type: VIEW_TYPE_STATS_HEATMAP, active: true });
            workspace.revealLeaf(leaf);
        }
    }
}
