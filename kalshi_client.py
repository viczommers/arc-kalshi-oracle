import requests
from datetime import datetime, timedelta, timezone


def implied_probability(market):
    """
    Calculate implied probability from market yes_bid and no_ask.

    Args:
        market: Market dict with yes_bid and no_ask fields

    Returns:
        float: Implied probability (0.0 to 1.0)
    """
    yes_bid = market.get("yes_bid")
    no_ask = market.get("no_ask")

    if yes_bid and yes_bid > 0:
        return yes_bid / 100.0

    if no_ask and no_ask > 0:
        return 1 - (no_ask / 100.0)

    return 0.5


def get_latest_maket():
    """
    Fetch today's EUR/USD market from Kalshi and return the most likely outcome.

    Returns:
        dict: {
            'price': str (e.g., '095'),
            'probability': float (0.0 to 1.0),
            'ticker': str,
            'yes_bid': int,
            'no_ask': int,
            'event': dict (full event data)
        }
        or None if no data available
    """
    try:
        url = "https://demo-api.kalshi.co/trade-api/v2/events"
        querystring = {
            "series_ticker": "KXEURUSD",
            "status": "open",
            "with_nested_markets": True,
        }
        response = requests.get(url, params=querystring)
        response.raise_for_status()
        result = response.json()

        events = result.get('events', [])
        if not events:
            return None

        # Sort by strike_date (earliest first)
        sorted_events = sorted(
            events,
            key=lambda x: x.get('strike_date', '9999-12-31T23:59:59Z')
        )

        event = sorted_events[0]
        markets = event.get("markets", [])

        if not markets:
            return None

        # Compute most likely outcome
        ranked = sorted(
            [(m["ticker"], implied_probability(m), m) for m in markets],
            key=lambda x: x[1],
            reverse=True
        )

        most_likely_ticker, most_likely_prob, most_likely_market = ranked[0]

        # Extract price component from ticker
        # Ticker format: KXEURUSD-25NOV1810-T1.17399 or KXEURUSD-25NOV1810-B1.17399
        # Split by '-' and get the last part, then remove the 'T' or 'B' prefix
        parts = most_likely_ticker.split('-')
        if parts:
            last_part = parts[-1]
            # Remove first character if it's 'T' or 'B'
            if last_part and last_part[0] in ['T', 'B']:
                price = last_part[1:]
            else:
                price = last_part
        else:
            price = most_likely_ticker

        return {
            'price': price,
            'probability': most_likely_prob,
            'ticker': most_likely_ticker,
            'yes_bid': most_likely_market.get('yes_bid'),
            'no_ask': most_likely_market.get('no_ask'),
            'event': event
        }

    except Exception as e:
        print(f"Error fetching Kalshi market: {e}")
        return None