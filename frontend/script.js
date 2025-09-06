document.addEventListener('DOMContentLoaded', () => {
    const tickerInput = document.getElementById('ticker-input');
    const industrySelect = document.getElementById('industry-select');
    const sharesInput = document.getElementById('shares-input');
    const addBtn = document.getElementById('add-btn');
    const portfolioTableBody = document.querySelector('#portfolio-table tbody');
    const portfolioTableHeader = document.querySelector('#portfolio-table thead');
    const filterTabs = document.querySelector('.filter-tabs');
    const totalValuationDisplay = document.getElementById('total-valuation-display');

    const API_URL = 'http://127.0.0.1:5001/api/stock';
    let portfolio = [];
    let currentFilter = '전체';
    let sortState = { column: 'valuation', direction: 'desc' }; // 기본 정렬: 평가금액 내림차순

    loadPortfolio();

    addBtn.addEventListener('click', addStock);
    filterTabs.addEventListener('click', handleFilter);
    portfolioTableHeader.addEventListener('click', handleSort);

    async function addStock() {
        const term = tickerInput.value.trim();
        const industry = industrySelect.value;
        const shares = parseInt(sharesInput.value, 10);

        if (!term) return alert('종목코드 또는 종목명을 입력하세요.');
        if (!shares || shares <= 0) return alert('올바른 보유 수량을 입력하세요.');

        try {
            const response = await fetch(`${API_URL}/${term}`);
            if (!response.ok) throw new Error('종목 정보를 가져오는 데 실패했습니다.');
            
            const stockData = await response.json();
            
            if (portfolio.find(stock => stock.ticker === stockData.ticker)) {
                return alert('이미 포트폴리오에 있는 종목입니다.');
            }

            const newItem = { ...stockData, industry, shares };
            portfolio.push(newItem);
            
            savePortfolio();
            sortAndRender();
            tickerInput.value = '';
            sharesInput.value = '';

        } catch (error) {
            alert(error.message);
        }
    }

    function sortAndRender() {
        sortPortfolio();
        renderPortfolio();
        updateSortHeaders();
    }

    function sortPortfolio() {
        const { column, direction } = sortState;
        if (!column) return;

        portfolio.sort((a, b) => {
            let valA, valB;
            const valuationA = a.price * a.shares;
            const valuationB = b.price * b.shares;

            switch (column) {
                case 'industry':
                    valA = a.industry;
                    valB = b.industry;
                    break;
                case 'rate':
                    valA = a.rate;
                    valB = b.rate;
                    break;
                case 'valuation':
                case 'weight': // 비중 정렬은 평가금액 정렬과 동일
                    valA = valuationA;
                    valB = valuationB;
                    break;
                default:
                    return 0;
            }

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    function renderPortfolio() {
        // 1. 총 평가금액 계산 (필터링 전 전체 포트폴리오 기준)
        const totalValuation = portfolio.reduce((sum, stock) => sum + (stock.price * stock.shares), 0);
        totalValuationDisplay.textContent = `${totalValuation.toLocaleString()}원`;

        // 2. 테이블 렌더링
        portfolioTableBody.innerHTML = '';
        const filteredPortfolio = portfolio.filter(stock => 
            currentFilter === '전체' || stock.industry === currentFilter
        );

        filteredPortfolio.forEach(stock => {
            const row = document.createElement('tr');
            const rate = parseFloat(stock.rate);
            const valuation = stock.price * stock.shares;
            const weight = totalValuation > 0 ? (valuation / totalValuation) * 100 : 0;
            let priceClass = rate === 0 ? 'price-even' : (rate > 0 ? 'price-up' : 'price-down');

            row.innerHTML = `
                <td><a href="info.html?search=${stock.ticker}" class="stock-link">${stock.name} (${stock.ticker})</a></td>
                <td>${stock.industry}</td>
                <td class="${priceClass}">${stock.price.toLocaleString()}</td>
                <td class="${priceClass}">${rate.toFixed(2)}%</td>
                <td>${stock.shares.toLocaleString()}</td>
                <td>${weight.toFixed(2)}%</td>
                <td>${valuation.toLocaleString()}원</td>
                <td><button class="delete-btn" data-ticker="${stock.ticker}">삭제</button></td>
            `;
            portfolioTableBody.appendChild(row);
        });

        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const tickerToDelete = e.target.dataset.ticker;
                portfolio = portfolio.filter(stock => stock.ticker !== tickerToDelete);
                savePortfolio();
                sortAndRender();
            });
        });
    }

    function handleFilter(e) {
        if (e.target.tagName !== 'BUTTON') return;
        document.querySelector('.tab-btn.active').classList.remove('active');
        e.target.classList.add('active');
        currentFilter = e.target.dataset.filter;
        renderPortfolio(); // 필터 변경 시 정렬은 유지하고 렌더링만 다시
    }

    function handleSort(e) {
        const th = e.target.closest('th');
        if (!th || !th.dataset.sort) return;

        const column = th.dataset.sort;
        if (sortState.column === column) {
            sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
            sortState.column = column;
            sortState.direction = 'desc';
        }
        sortAndRender();
    }
    
    function updateSortHeaders() {
        portfolioTableHeader.querySelectorAll('th').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            if (th.dataset.sort === sortState.column) {
                th.classList.add(sortState.direction === 'asc' ? 'sort-asc' : 'sort-desc');
            }
        });
    }

    function savePortfolio() {
        localStorage.setItem('stockPortfolio', JSON.stringify(portfolio));
    }

    function loadPortfolio() {
        const savedPortfolio = localStorage.getItem('stockPortfolio');
        if (savedPortfolio) {
            portfolio = JSON.parse(savedPortfolio);
            sortAndRender();
            updateAllStocks();
        }
    }

    async function updateAllStocks() {
        const updatePromises = portfolio.map(async (stock) => {
            try {
                const response = await fetch(`${API_URL}/${stock.ticker}`);
                if (!response.ok) return stock;
                const updatedData = await response.json();
                return { ...stock, ...updatedData };
            } catch (error) {
                console.error(`Error updating ${stock.ticker}:`, error);
                return stock;
            }
        });

        portfolio = await Promise.all(updatePromises);
        savePortfolio();
        sortAndRender();
    }
    
    setInterval(updateAllStocks, 300000);
});
