if (this.chartInstance) this.chartInstance.destroy();
            
            const ctx = (chartCanvas as HTMLCanvasElement).getContext('2d');
            
            // 1. 定义 Apple Keynote 级别的物理光影插件
            const neonGlowPlugin = {
                id: 'neonGlow',
                beforeDatasetDraw: (chart: any, args: any) => {
                    const ctx = chart.ctx;
                    ctx.save();
                    // 设置深邃的坠落阴影与外发光
                    ctx.shadowColor = 'rgba(0, 122, 255, 0.45)'; 
                    ctx.shadowBlur = 18;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 8;
                },
                afterDatasetDraw: (chart: any) => {
                    chart.ctx.restore();
                }
            };

            // 2. 为线条本身创建一个水平质感渐变（而非背景填充）
            let lineGradient: string | CanvasGradient = '#007AFF';
            if (ctx) {
                lineGradient = ctx.createLinearGradient(0, 0, chartWrapper.clientWidth, 0);
                lineGradient.addColorStop(0, '#32ADE6');    // 亮青蓝起手
                lineGradient.addColorStop(0.5, '#007AFF');  // 纯正苹果蓝过渡
                lineGradient.addColorStop(1, '#0040DD');    // 深邃靛蓝收尾
            }

            this.chartInstance = new Chart(chartCanvas as any, {
                type: 'line',
                plugins: [neonGlowPlugin], // 注入光影引擎
                data: {
                    labels: chartLabels,
                    datasets: [{
                        label: '新增笔记数',
                        data: chartValues,
                        borderColor: lineGradient, 
                        borderWidth: 4.5, // 极度加粗，增强物理实体感
                        backgroundColor: 'transparent', // 彻底抛弃廉价的面积填充
                        pointRadius: 0, 
                        pointHoverRadius: 7,
                        pointBackgroundColor: '#FFFFFF',
                        pointBorderColor: '#007AFF',
                        pointBorderWidth: 3,
                        tension: 0.4, // 恢复优雅的苹果曲线张力
                        fill: false // 关键：关闭填充
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: { top: 30, bottom: 10, left: 10, right: 20 } // 增加四周呼吸空间，防止割裂
                    },
                    animation: {
                        duration: 1500, // 稍微拉长动画时间，让发光线条流出更丝滑
                        easing: 'easeOutQuart',
                        active: { duration: 400 }
                    },
                    interaction: { mode: 'index', intersect: false },
                    plugins: { 
                        legend: { display: false },
                        tooltip: { 
                            backgroundColor: 'rgba(28, 28, 30, 0.85)',
                            backdropFilter: 'blur(16px)',
                            padding: 14,
                            cornerRadius: 12, // 更圆润的 iOS 气泡
                            displayColors: false,
                            titleFont: { size: 14, weight: '600' as const, family: '-apple-system, sans-serif' },
                            bodyFont: { size: 13, family: '-apple-system, sans-serif' },
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    scales: { 
                        x: { 
                            display: true, 
                            border: { display: false }, 
                            grid: { display: false }, 
                            ticks: { 
                                color: '#8E8E93', 
                                maxRotation: 45,
                                font: { family: '-apple-system, sans-serif', size: 11 },
                                padding: 8
                            } 
                        },
                        y: { 
                            beginAtZero: true, 
                            border: { display: false }, 
                            grid: { 
                                color: 'rgba(142, 142, 147, 0.12)', 
                                drawTicks: false, 
                                borderDash: [6, 6] // 采用更宽距的虚线
                            }, 
                            ticks: { 
                                precision: 0, 
                                color: '#8E8E93', 
                                padding: 15, // 让 Y 轴数字远离图表，提升空间感
                                font: { family: '-apple-system, sans-serif', size: 11 }
                            }
                        }
                    } 
                }
            });
