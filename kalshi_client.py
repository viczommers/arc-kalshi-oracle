import requests
from datetime import datetime, timedelta, timezone

def get_todays_maket():
    tomorrow_utc = datetime.now(timezone.utc) + timedelta(hours=24)
    tomorrow_timestamp = int(tomorrow_utc.timestamp())
    try:
        url = "https://api.elections.kalshi.com/trade-api/v2/markets"
        url = "https://demo-api.kalshi.co/trade-api/v2/markets"
        querystring = {
            "series_ticker":"KXEURUSD",
            "status": "open",
            }
        response = requests.get(url, params=querystring)
        response.raise_for_status()
        result = response.json()
        markets = result.get('markets',[])
        if markets:
            # Sort by expected_expiration_time (earliest first)
            sorted_markets = sorted(
                markets,
                key=lambda x: x.get('expected_expiration_time', '9999-12-31T23:59:59Z')
            )
            return sorted_markets[0]
            
    except Exception as e:
        print("Error ", e)
        return None

market_id = get_todays_maket()
market_id