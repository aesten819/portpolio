document.addEventListener('DOMContentLoaded', () => {
    const tickerInput = document.getElementById('ticker-input');
    const industrySelect = document.getElementById('industry-select');
    const sharesInput = document.getElementById('shares-input');
    const addBtn = document.getElementById('add-btn');
    const portfolioTableBody = document.querySelector('#portfolio-table tbody');
    const portfolioTableHeader = document.querySelector('#portfolio-table thead');
    const filterTabs = document.querySelector('.filter-tabs');
    const totalValuationDisplay = document.getElementById('total-valuation-display');

    const API_BASE_URL = 'http://127.0.0.1:5001/api';

    let portfolio = [];
    let currentFilter = '전체';
    let sortState = { column: 'valuation', direction: 'desc' }; // 기본 정렬: 평가금액 내림차순

    loadPortfolio();

    addBtn.addEventListener('click', addStock);
    filterTabs.addEventListener('click', handleFilter);
    portfolioTableHeader.addEventListener('click', handleSort);
    portfolioTableBody.addEventListener('change', handleSharesUpdate);

    async function addStock() {
        const term = tickerInput.value.trim();
        const industry = industrySelect.value;
        const shares = parseInt(sharesInput.value, 10);

        if (!term) return alert('종목코드 또는 종목명을 입력하세요.');
        if (!shares || shares <= 0) return alert('올바른 보유 수량을 입력하세요.');

        try {
            const response = await fetch(`${API_BASE_URL}/stock/${term}`);
            if (!response.ok) throw new Error('종목 정보를 가져오는 데 실패했습니다.');
            
            const stockData = await response.json();
            
            if (portfolio.find(stock => stock.ticker === stockData.ticker)) {
                return alert('이미 포트폴리오에 있는 종목입니다.');
            }

            const newItem = { ...stockData, industry, shares };
            portfolio.push(newItem);
            
            await savePortfolio();
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
        const totalValuation = portfolio.reduce((sum, stock) => sum + (stock.price * stock.shares), 0);
        totalValuationDisplay.textContent = `${totalValuation.toLocaleString()}원`;

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
                <td><a href="https://alphasquare.co.kr/home/stock-information?code=${stock.ticker}" target="_blank" class="stock-link">${stock.name} (${stock.ticker})</a></td>
                <td>${stock.industry}</td>
                <td class="${priceClass}">${stock.price.toLocaleString()}</td>
                <td class="${priceClass}">${rate.toFixed(2)}%</td>
                <td><input type="number" class="shares-input-cell" value="${stock.shares}" data-ticker="${stock.ticker}" min="1"></td>
                <td>${valuation.toLocaleString()}원</td>
                <td><button class="delete-btn" data-ticker="${stock.ticker}">삭제</button></td>
            `;
            portfolioTableBody.appendChild(row);
        });

        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const tickerToDelete = e.target.dataset.ticker;
                portfolio = portfolio.filter(stock => stock.ticker !== tickerToDelete);
                await savePortfolio();
                sortAndRender();
            });
        });
    }

    function handleFilter(e) {
        if (e.target.tagName !== 'BUTTON') return;
        document.querySelector('.tab-btn.active').classList.remove('active');
        e.target.classList.add('active');
        currentFilter = e.target.dataset.filter;
        renderPortfolio();
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
    
    async function handleSharesUpdate(e) {
        if (!e.target.classList.contains('shares-input-cell')) return;

        const ticker = e.target.dataset.ticker;
        const newShares = parseInt(e.target.value, 10);
        const stockToUpdate = portfolio.find(stock => stock.ticker === ticker);

        if (stockToUpdate && newShares > 0) {
            stockToUpdate.shares = newShares;
            await savePortfolio();
            sortAndRender();
        } else if (stockToUpdate) {
            e.target.value = stockToUpdate.shares; 
        }
    }

    function updateSortHeaders() {
        portfolioTableHeader.querySelectorAll('th').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            if (th.dataset.sort === sortState.column) {
                th.classList.add(sortState.direction === 'asc' ? 'sort-asc' : 'sort-desc');
            }
        });
    }

    async function savePortfolio() {
        try {
            await fetch(`${API_BASE_URL}/portfolio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(portfolio)
            });
        } catch (error) {
            console.error('포트폴리오 저장 실패:', error);
            alert('포트폴리오를 서버에 저장하는 데 실패했습니다.');
        }
    }

    async function loadPortfolio() {
        try {
            const response = await fetch(`${API_BASE_URL}/portfolio`);
            if (!response.ok) throw new Error('서버에서 포트폴리오를 불러오는 데 실패했습니다.');
            
            const savedPortfolio = await response.json();
            if (savedPortfolio && savedPortfolio.length > 0) {
                portfolio = savedPortfolio;
                sortAndRender();
                updateAllStocks();
            }
        } catch (error) {
            console.error('포트폴리오 로드 실패:', error);
            alert(error.message);
        }
    }

    async function updateAllStocks() {
        const updatePromises = portfolio.map(async (stock) => {
            try {
                const response = await fetch(`${API_BASE_URL}/stock/${stock.ticker}`);
                if (!response.ok) return stock; // 실패 시 기존 데이터 유지
                const updatedData = await response.json();
                // 기존 'industry'와 'shares' 정보는 유지하면서 최신 가격 정보만 업데이트
                return { ...stock, ...updatedData, industry: stock.industry, shares: stock.shares };
            } catch (error) {
                console.error(`Error updating ${stock.ticker}:`, error);
                return stock; // 에러 발생 시에도 기존 데이터 유지
            }
        });

        portfolio = await Promise.all(updatePromises);
        await savePortfolio();
        sortAndRender();
    }
    
    setInterval(updateAllStocks, 300000);
});