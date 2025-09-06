document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const durationInput = document.getElementById('duration-input');
    const searchBtn = document.getElementById('search-btn');
    const stockInfoContainer = document.getElementById('stock-info-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    
    const stockNameEl = document.getElementById('stock-name');
    const currentPriceEl = document.getElementById('current-price');
    const marketCapEl = document.getElementById('market-cap');
    const chartCanvas = document.getElementById('stock-chart');
    
    const API_URL = 'http://127.0.0.1:5001/api/stock_details';
    let stockChart = null;

    // --- 페이지 로드 시 URL 파라미터 확인 및 자동 검색 ---
    const urlParams = new URLSearchParams(window.location.search);
    const searchTermFromUrl = urlParams.get('search');
    if (searchTermFromUrl) {
        searchInput.value = searchTermFromUrl;
        searchStock();
    }
    // ----------------------------------------------------

    searchBtn.addEventListener('click', searchStock);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchStock();
    });
    durationInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchStock();
    });

    async function searchStock() {
        const term = searchInput.value.trim();
        const duration = parseInt(durationInput.value, 10);

        if (!term) return alert('검색어를 입력하세요.');
        if (duration < 60) return alert('조회 기간이 너무 짧습니다!');

        stockInfoContainer.classList.add('hidden');
        loadingIndicator.classList.remove('hidden');

        try {
            const response = await fetch(`${API_URL}/${term}?days=${duration}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '데이터를 가져오는 데 실패했습니다.');
            }
            const data = await response.json();
            displayStockInfo(data);
        } catch (error) {
            alert(error.message);
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    }

    function displayStockInfo(data) {
        stockNameEl.textContent = `${data.name} (${data.ticker})`;
        currentPriceEl.textContent = `${data.current_price.toLocaleString()}원`;
        marketCapEl.textContent = data.market_cap;

        renderChart(data.chart_data);
        stockInfoContainer.classList.remove('hidden');
    }

    function renderChart(chartData) {
        const ctx = chartCanvas.getContext('2d');
        if (stockChart) {
            stockChart.destroy();
        }

        const maxVolume = Math.max(...chartData.volumes);
        const volumeAxisMax = maxVolume * (1600 / 250);

        stockChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.dates,
                datasets: [
                    {
                        type: 'line',
                        label: '종가',
                        data: chartData.prices,
                        borderColor: '#3498db',
                        fill: false,
                        tension: 0.1,
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        yAxisID: 'y',
                    },
                    {
                        type: 'bar',
                        label: '거래량',
                        data: chartData.volumes,
                        backgroundColor: 'rgba(150, 150, 150, 0.6)',
                        borderColor: 'rgba(150, 150, 150, 0.6)',
                        yAxisID: 'y1',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        position: 'left',
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString() + '원';
                            }
                        }
                    },
                    y1: {
                        display: false,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false,
                        },
                        ticks: {
                            display: false,
                        },
                        max: volumeAxisMax
                    }
                }
            }
        });
    }
});