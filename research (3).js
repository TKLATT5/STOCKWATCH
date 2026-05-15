export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { ticker } = req.body;
    if (!ticker) return res.status(400).json({ error: 'Ticker required' });

    const prompt = `You are a stock data API. Research ${ticker} using web search and return a JSON object with current market data. Return ONLY the raw JSON object with no markdown, no backticks, no explanation text. Start your response with { and end with }.

Fill in real current data for all fields:
{
  "ticker": "${ticker}",
  "name": "company full name",
  "sector": "sector name",
  "exchange": "NYSE or NASDAQ",
  "description": "what company does in 1-2 sentences",
  "price": {
    "current": 0.00,
    "prev_close": 0.00,
    "week52_high": 0.00,
    "week52_low": 0.00,
    "market_cap": "$0B",
    "volume": "0M"
  },
  "technicals": {
    "sma50": 0.00,
    "sma200": 0.00,
    "sma50_signal": "above",
    "sma200_signal": "above",
    "rsi": 50,
    "rsi_signal": "neutral",
    "trend": "uptrend",
    "support": 0.00,
    "resistance": 0.00
  },
  "valuation": {
    "pe_trailing": 0.0,
    "pe_forward": 0.0,
    "dividend_yield": "0%",
    "beta": 0.00
  },
  "earnings": {
    "latest_quarter": "Q1 2026",
    "gaap_eps": 0.00,
    "non_gaap_eps": 0.00,
    "gap_reason": "reason for gap",
    "revenue": "$0B",
    "revenue_growth": "+0%",
    "gross_margin": "0%",
    "next_earnings_date": "Month DD YYYY"
  },
  "analyst": {
    "consensus": "Buy",
    "num_analysts": 0,
    "target_high": 0.00,
    "target_median": 0.00,
    "target_low": 0.00,
    "implied_upside": "+0%",
    "recent_actions": ["action 1", "action 2"]
  },
  "news": [
    {"headline": "headline 1", "sentiment": "bullish", "date": "May 14", "impact": "high"},
    {"headline": "headline 2", "sentiment": "neutral", "date": "May 13", "impact": "medium"},
    {"headline": "headline 3", "sentiment": "bearish", "date": "May 12", "impact": "low"}
  ],
  "investments": ["investment or deal 1", "investment or deal 2"],
  "risks": ["risk 1", "risk 2"],
  "catalysts": ["catalyst 1", "catalyst 2"],
  "assessment": {
    "signal": "BUY",
    "conviction": "medium",
    "suggested_buy_zone": 0.00,
    "suggested_sell_zone": 0.00,
    "summary": "2 sentence honest assessment of the stock right now"
  }
}`;

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
        max_tokens: 3000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    
    // Extract all text from content blocks
    let text = '';
    if (data.content) {
      for (const block of data.content) {
        if (block.type === 'text') text += block.text;
      }
    }

    // Clean up common formatting issues
    text = text.trim();
    // Remove markdown code blocks if present
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    text = text.trim();

    // Try to extract JSON - find first { to last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1) {
      return res.status(500).json({ error: 'No JSON found in response', raw: text.substring(0, 200) });
    }

    const jsonStr = text.substring(firstBrace, lastBrace + 1);
    
    try {
      const parsed = JSON.parse(jsonStr);
      return res.status(200).json(parsed);
    } catch(parseErr) {
      return res.status(500).json({ error: 'JSON parse failed', raw: jsonStr.substring(0, 200) });
    }

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
