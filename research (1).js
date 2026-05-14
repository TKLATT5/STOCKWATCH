// Vercel Serverless Function — API Key Proxy
// Your Anthropic API key lives in Vercel environment variables ONLY
// It never touches the browser or GitHub

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers — allow your own domain only in production
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Get API key from Vercel environment (never from client)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  try {
    const { ticker, mode } = req.body;
    if (!ticker) return res.status(400).json({ error: 'Ticker required' });

    // Build the research prompt
    const prompt = buildPrompt(ticker, mode);

    // Call Anthropic API server-side — key is safe here
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();

    // Extract text from content blocks
    let text = '';
    if (data.content) {
      for (const block of data.content) {
        if (block.type === 'text') text += block.text;
      }
    }

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Could not parse AI response' });

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Research error:', err);
    return res.status(500).json({ error: err.message });
  }
}

function buildPrompt(ticker, mode) {
  return `You are a professional stock analyst terminal. Research ${ticker} comprehensively as of today. Use your web search tool to find the most current data. Return ONLY a JSON object with no other text:

{
  "ticker": "${ticker}",
  "name": "full company name",
  "sector": "sector",
  "exchange": "NYSE/NASDAQ/etc",
  "description": "2-3 sentence company description",
  "price": {
    "current": 0.00,
    "prev_close": 0.00,
    "day_high": 0.00,
    "day_low": 0.00,
    "week52_high": 0.00,
    "week52_low": 0.00,
    "market_cap": "e.g. $2.1T",
    "volume": "e.g. 45M",
    "avg_volume": "e.g. 52M"
  },
  "technicals": {
    "sma50": 0.00,
    "sma200": 0.00,
    "sma50_signal": "above/below",
    "sma200_signal": "above/below",
    "rsi": 0,
    "rsi_signal": "overbought/oversold/neutral",
    "macd_signal": "bullish/bearish/neutral",
    "trend": "uptrend/downtrend/sideways",
    "support": 0.00,
    "resistance": 0.00
  },
  "valuation": {
    "pe_trailing": 0.0,
    "pe_forward": 0.0,
    "peg": 0.0,
    "ps_ratio": 0.0,
    "pb_ratio": 0.0,
    "ev_ebitda": 0.0,
    "dividend_yield": "0.00%",
    "beta": 0.00
  },
  "earnings": {
    "latest_quarter": "Q1 2026",
    "gaap_eps": 0.00,
    "non_gaap_eps": 0.00,
    "eps_gap": 0.00,
    "gap_reason": "what drives the GAAP vs non-GAAP difference",
    "revenue": "$0B",
    "revenue_growth": "+0%",
    "gross_margin": "0%",
    "net_margin": "0%",
    "next_earnings_date": "Month DD, YYYY"
  },
  "analyst": {
    "consensus": "Strong Buy/Buy/Hold/Sell",
    "num_analysts": 0,
    "target_high": 0.00,
    "target_median": 0.00,
    "target_low": 0.00,
    "implied_upside": "+0%",
    "recent_actions": ["Firm raises target to $X", "Firm reiterates Buy"]
  },
  "news": [
    {"headline": "headline", "sentiment": "bullish/bearish/neutral", "date": "May 13", "impact": "high/medium/low"},
    {"headline": "headline", "sentiment": "bullish/bearish/neutral", "date": "May 12", "impact": "high/medium/low"},
    {"headline": "headline", "sentiment": "bullish/bearish/neutral", "date": "May 11", "impact": "high/medium/low"},
    {"headline": "headline", "sentiment": "bullish/bearish/neutral", "date": "May 10", "impact": "high/medium/low"},
    {"headline": "headline", "sentiment": "bullish/bearish/neutral", "date": "May 9", "impact": "high/medium/low"}
  ],
  "investments": [
    "Major investment or strategic move 1",
    "Major investment or strategic move 2",
    "Major investment or strategic move 3"
  ],
  "risks": [
    "Key risk 1",
    "Key risk 2",
    "Key risk 3"
  ],
  "catalysts": [
    "Upcoming catalyst 1",
    "Upcoming catalyst 2",
    "Upcoming catalyst 3"
  ],
  "assessment": {
    "signal": "BUY/HOLD/WATCH/SELL",
    "conviction": "high/medium/low",
    "suggested_buy_zone": 0.00,
    "suggested_sell_zone": 0.00,
    "summary": "2-3 sentence honest assessment"
  }
}

If this is an ETF adapt accordingly. Return ONLY the JSON, nothing else.`;
}
