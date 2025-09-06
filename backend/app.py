from flask import Flask, jsonify, request
from pykrx import stock
from flask_cors import CORS
import re
from datetime import datetime, timedelta
import numpy

app = Flask(__name__)
CORS(app)

# 통합 검색을 위한 데이터 (메모리 캐싱)
ticker_map = {}
stock_tickers = set()
etf_tickers = set()

def initialize_tickers():
    """서버 시작 시 주식 및 ETF 종목 코드와 이름을 모두 맵핑합니다."""
    global ticker_map, stock_tickers, etf_tickers
    if ticker_map: return
    print("Initializing all tickers (Stocks & ETFs)...")
    for market in ["KOSPI", "KOSDAQ"]:
        for ticker in stock.get_market_ticker_list(market=market):
            name = stock.get_market_ticker_name(ticker)
            ticker_map[name] = ticker
            stock_tickers.add(ticker)
    for ticker in stock.get_etf_ticker_list():
        name = stock.get_etf_ticker_name(ticker)
        ticker_map[name] = ticker
        etf_tickers.add(ticker)
    print("Ticker initialization complete.")

def get_ticker_from_term(term):
    """입력된 값(term)이 종목명이면 코드를, 종목코드면 그대로 반환합니다."""
    return term if re.match(r'^\d{6}$', term) else ticker_map.get(term)

def format_market_cap(cap_in_won):
    """시가총액(원)을 조, 억 단위의 문자열로 변환합니다."""
    if not isinstance(cap_in_won, (int, numpy.int64)) or cap_in_won <= 0:
        return 'N/A'
    
    ONE_TRILLION = 1_000_000_000_000
    ONE_HUNDRED_MILLION = 100_000_000

    if cap_in_won >= ONE_TRILLION:
        jo = cap_in_won // ONE_TRILLION
        remaining = cap_in_won % ONE_TRILLION
        eok = remaining // ONE_HUNDRED_MILLION
        return f"{jo:,}조 {eok:,}억원" if eok > 0 else f"{jo:,}조원"
    else:
        eok = cap_in_won // ONE_HUNDRED_MILLION
        return f"{eok:,}억원"

@app.route('/api/stock/<term>')
def get_asset_info(term):
    try:
        ticker = get_ticker_from_term(term)
        if not ticker: return jsonify({"error": f"Invalid ticker or name: {term}"}), 404
        today = stock.get_nearest_business_day_in_a_week()
        
        if ticker in etf_tickers:
            df = stock.get_etf_ohlcv_by_date(today, today, ticker)
            name = stock.get_etf_ticker_name(ticker)
        elif ticker in stock_tickers:
            df = stock.get_market_ohlcv_by_date(today, today, ticker)
            name = stock.get_market_ticker_name(ticker)
        else:
            return jsonify({"error": f"Ticker not found: {ticker}"}), 404

        if df.empty: return jsonify({"error": "No data available"}), 404
        info = df.iloc[0]
        rate = info.get('등락률', (info["종가"] / info["시가"] - 1) * 100 if info["시가"] > 0 else 0)
        
        return jsonify({
            "ticker": ticker, "name": name, "price": int(info["종가"]),
            "change": int(info["종가"] - info["시가"]), "rate": float(rate)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/stock_details/<term>')
def get_stock_details(term):
    try:
        days = request.args.get('days', default=60, type=int)
        if days < 60: days = 60

        ticker = get_ticker_from_term(term)
        if not ticker: return jsonify({"error": f"Invalid ticker or name: {term}"}), 404

        start_day_str = (datetime.now() - timedelta(days=days * 1.5 + 5)).strftime('%Y%m%d')
        today_str = datetime.now().strftime('%Y%m%d')

        if ticker in etf_tickers:
            df_ohlcv = stock.get_etf_ohlcv_by_date(start_day_str, today_str, ticker).tail(days)
            name = stock.get_etf_ticker_name(ticker)
        elif ticker in stock_tickers:
            df_ohlcv = stock.get_market_ohlcv_by_date(start_day_str, today_str, ticker).tail(days)
            name = stock.get_market_ticker_name(ticker)
        else:
            return jsonify({"error": f"Ticker not found: {ticker}"}), 404
        
        if df_ohlcv.empty: return jsonify({"error": "No chart data available"}), 404

        chart_data = {
            'dates': [d.strftime('%Y-%m-%d') for d in df_ohlcv.index],
            'prices': [int(p) for p in df_ohlcv['종가']],
            'volumes': [int(v) for v in df_ohlcv['거래량']] # 거래량 데이터 추가
        }
        
        latest_price = chart_data['prices'][-1]
        
        latest_business_day = stock.get_nearest_business_day_in_a_week()
        market_cap_series = stock.get_market_cap_by_ticker(latest_business_day)
        market_cap_raw = market_cap_series.loc[ticker, '시가총액'] if ticker in stock_tickers and ticker in market_cap_series.index else 'N/A'

        details = {
            "ticker": ticker, "name": name, "current_price": int(latest_price),
            "market_cap": format_market_cap(market_cap_raw),
            "chart_data": chart_data
        }
        return jsonify(details)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    initialize_tickers()
    app.run(debug=True, port=5001)