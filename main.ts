import { App, ItemView, Plugin, WorkspaceLeaf, Notice, Modal, TFile, setIcon } from 'obsidian';

const VIEW_TYPE_STATS_HEATMAP = "desktop-stats-heatmap-view";

// --- 基础虚词过滤库 ---
const STOP_WORDS = new Set([
    'the', 'and', 'for', 'that', 'this', 'with', 'from', 'https', 'com', 'org', 
    'www', 'are', 'can', 'not', 'you', 'your', 'have', 'was', 'but', 'all', 
    'what', 'http', 'html', 'file', 'png', 'jpg', 'out', 'has', 'will', 'use',
    'which', 'when', 'more', 'about', 'their', 'there', 'some', '因此', '通过',
    '可以', '一个', '没有', '我们', '什么', '这个', '如果是', '怎么', '如果',
    '可以说', '这样', '很多', '非常', '进行', '然后'
]);

// --- 数据分析引擎 (追踪文件来源与上下文片段) ---
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
                .slice(0, 75) 
                .map(([word, data]) => ({ word, value: data.count, files: Array.from(data.files) }));
}

// --- 颜色引擎 ---
function getTextOpacity(value: number, max: number): number {
    const ratio = Math.min(value / max, 1);
    return 0.45 + (ratio * 0.55); // 确保浅色模式下最低透明度也清晰可读
}

// --- 核心功能：沉浸式上下文溯源 Modal ---
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
        
        // Modal 苹果风精致样式
        this.modalEl.style.maxWidth = '800px';
        this.modalEl.style.width = '90vw';
        this.modalEl.style.borderRadius = '20px';
        this.modalEl.style.padding = '32px 40px';
        this.modalEl.style.boxShadow = '0 20px 40px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)';
        this.modalEl.style.border = '1px solid var(--background-modifier-border)';

        contentEl.createEl('h2', { 
            text: `「${this.word}」`,
            attr: { style: 'margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: var(--interactive-accent); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif; letter-spacing: -0.02em;' }
        });
        contentEl.createEl('p', {
            text: `在 ${this.files.length} 篇笔记中被提及`,
            attr: { style: 'margin: 0 0 24px 0; color: var(--text-muted); font-size: 15px; font-weight: 500;' }
        });

        const listContainer = contentEl.createDiv({
            attr: { style: 'max-height: 60vh; overflow-y: auto; padding-right: 12px; display: flex; flex-direction: column; gap: 16px;' }
        });

        this.app.workspace.addDomBatchUpdate(async () => {
            for (const file of this.files) {
                const content = await this.app.vault.cachedRead(file);
                
                const safeWord = this.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
                const regex = new RegExp(`.{0,40}${safeWord}.{0,40}`, 'gi');
                const matches = content.match(regex) || [];

                if (matches.length > 0) {
                    const card = listContainer.createDiv({
                        attr: { style: 'background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 12px; padding: 16px; cursor: pointer; transition: all 0.2s ease;' }
                    });
                    
                    card.addEventListener('mouseenter', () => {
                        card.style.borderColor = 'var(--interactive-accent)';
                        card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
                    });
                    card.addEventListener('mouseleave', () => {
                        card.style.borderColor = 'var(--background-modifier-border)';
                        card.style.boxShadow = 'none';
                    });

                    card.addEventListener('click', async () => {
                        const leaf = this.app.workspace.getLeaf(false);
                        await leaf.openFile(file);
                        this.close(); 
                    });

                    const fileTitle = card.createEl('div', {
                        attr: { style: 'font-weight: 600; font-size: 16px; margin-bottom: 12px; color: var(--text-normal); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif; display: flex; align-items: center;' }
                    });
                    const fileIconSpan = fileTitle.createEl('span', { attr: { style: 'margin-right: 8px; opacity: 0.6; display: flex; align-items: center;' } });
                    setIcon(fileIconSpan, 'file-text');
                    fileTitle.appendChild(document.createTextNode(file.basename));

                    const displayMatches = matches.slice(0, 3);
                    for (let match of displayMatches) {
                        const snippetDiv = card.createDiv({ attr: { style: 'font-size: 14px; color: var(--text-muted); line-height: 1.5; margin-bottom: 8px; background: var(--background-secondary); padding: 8px 12px; border-radius: 8px;' } });
                        
                        const parts = match.split(new RegExp(`(${safeWord})`, 'gi'));
                        snippetDiv.appendChild(document.createTextNode('"...'));
                        parts.forEach(part => {
                            if (part.toLowerCase() === this.word.toLowerCase()) {
                                snippetDiv.createEl('span', { text: part, attr: { style: 'color: var(--interactive-accent); font-weight: 600;' } });
                            } else {
                                snippetDiv.appendChild(document.createTextNode(part));
                            }
                        });
                        snippetDiv.appendChild(document.createTextNode('..."'));
                    }
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
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() { return VIEW_TYPE_STATS_HEATMAP; }
    getDisplayText() { return "知识洞察"; }
    getIcon() { return "key"; } 

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('stats-typographic-dashboard');

        // 顶级容器排版优化：适度的留白
        container.setAttr('style', `
            padding: 32px;
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow-y: auto;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
            -webkit-font-smoothing: antialiased;
            background-color: var(--background-secondary);
        `);

        // --- 标题区排版重构：Apple 官网级精细排版 ---
        const headerDiv = container.createDiv({ 
            attr: { 
                style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-shrink: 0; cursor: pointer; user-select: none; opacity: 0.9; transition: opacity 0.2s ease;',
                title: '点击重新扫描'
            } 
        });
        
        const titleDiv = headerDiv.createDiv({
            attr: { style: 'display: flex; align-items: center; white-space: nowrap;' }
        });
        const iconSpan = titleDiv.createEl('span', { attr: { style: 'width: 24px; height: 24px; color: var(--interactive-accent); margin-right: 12px; display: flex; align-items: center;' } });
        setIcon(iconSpan, 'activity'); // 使用更精致的 activity 图标
        
        // 字体收敛：去掉 850 字重，改为 700 + -0.02em 紧凑字间距
        const titleText = titleDiv.createEl("h1", { 
            text: "Knowledge Insights", 
            attr: { 
                style: 'margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; color: var(--text-normal); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif;' 
            } 
        });

        const startScanning = async () => {
            headerDiv.style.opacity = '0.4';
            titleText.innerText = "Scanning...";
            headerDiv.style.pointerEvents = 'none';
            await this.renderWords();
            headerDiv.style.pointerEvents = 'auto';
            titleText.innerText = "Knowledge Insights";
            headerDiv.style.opacity = '0.9';
        }
        
        headerDiv.addEventListener('mouseenter', () => headerDiv.style.opacity = '1');
        headerDiv.addEventListener('mouseleave', () => headerDiv.style.opacity = '0.9');
        headerDiv.addEventListener('click', startScanning);

        // --- 核心画板：干净、无冗余边界的沉浸式卡片 ---
        this.wordsCanvas = container.createDiv({ 
            attr: { 
                // 核心排版技术：align-items: baseline 保证不同字号文字底部对齐，视觉极其规整
                style: 'display: flex; flex-wrap: wrap; gap: 12px 24px; justify-content: center; align-content: flex-start; align-items: baseline; background-color: var(--background-primary); border-radius: 24px; padding: 40px; box-shadow: 0 8px 24px rgba(0,0,0,0.03), 0 2px 8px rgba(0,0,0,0.02); flex: 1;' 
            } 
        });

        await this.renderWords();
    }

    async renderWords() {
        if (!this.wordsCanvas) return;
        this.wordsCanvas.empty();
        
        const heatmapWords = await analyzeVaultData(this.app);

        if (heatmapWords.length === 0) {
            this.wordsCanvas.createEl("div", { text: "暂无数据积累", attr: { style: 'color: var(--text-muted); font-size: 14px;' } });
            return;
        }

        const maxWordCount = heatmapWords[0].value;

        heatmapWords.forEach(({word, value, files}) => {
            const wordEl = this.wordsCanvas.createDiv();
            wordEl.setText(word);
            
            const opacity = getTextOpacity(value, maxWordCount);
            // 字号收敛：14px 到 46px，取消夸张的巨型字
            const fontSize = Math.max(14, Math.min(46, 14 + (value/maxWordCount)*32));
            // 阶梯式字重映射，构建 Apple 级视觉层级
            const fontWeight = value > maxWordCount * 0.6 ? '700' : (value > maxWordCount * 0.3 ? '600' : '500');
            
            wordEl.setAttr("style", `
                color: rgba(0, 122, 255, ${opacity}); 
                font-size: ${fontSize}px;
                font-weight: ${fontWeight};
                cursor: pointer;
                transition: all 0.2s ease-out;
                line-height: 1.1;
                user-select: none;
                letter-spacing: -0.01em;
                white-space: nowrap; /* 绝对禁止内部折行 */
            `);
            
            wordEl.addEventListener('mouseenter', () => {
                wordEl.style.transform = 'scale(1.05)';
                wordEl.style.color = 'rgba(0, 122, 255, 1)';
            });
            
            wordEl.addEventListener('mouseleave', () => {
                wordEl.style.transform = 'scale(1)';
                wordEl.style.color = `rgba(0, 122, 255, ${opacity})`;
            });

            wordEl.addEventListener('click', () => {
                new WordContextModal(this.app, word, files).open();
            });
        });
    }
}

export default class DesktopStatsPlugin extends Plugin {
    async onload() {
        this.registerView(VIEW_TYPE_STATS_HEATMAP, (leaf) => new DesktopStatsHeatmapView(leaf));
        
        this.addRibbonIcon('key', '打开知识洞察', () => {
            this.activateView();
        });

        this.addCommand({
            id: 'open-typographic-insights',
            name: '打开知识洞察',
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
            existingLeaves[i].detach(); 
        }

        const leaf = workspace.getRightLeaf(false);
        if (leaf) {
            await leaf.setViewState({ type: VIEW_TYPE_STATS_HEATMAP, active: true });
            workspace.revealLeaf(leaf);
        }
    }
}
