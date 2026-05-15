export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const { ticker } = req.body;
    if (!ticker) return res.status(400).json({ error: 'Ticker required' });

    const prompt = `Search the web for current ${ticker} stock data today May 2026. Find the real current price and recent data. Return ONLY a JSON object starting with { and ending with }, no markdown:
{"ticker":"${ticker}","name":"","sector":"","exchange":"","description":"","price":{"current":0.00,"prev_close":0.00,"week52_high":0.00,"week52_low":0.00,"market_cap":"","volume":""},"technicals":{"sma50":0.00,"sma200":0.00,"sma50_signal":"above/below","sma200_signal":"above/below","rsi":0,"rsi_signal":"neutral","trend":"uptrend/downtrend/sideways","support":0.00,"resistance":0.00},"valuation":{"pe_trailing":0.0,"pe_forward":0.0,"dividend_yield":"0%","beta":0.00},"earnings":{"latest_quarter":"","gaap_eps":0.00,"non_gaap_eps":0.00,"gap_reason":"","revenue":"","revenue_growth":"","gross_margin":"","next_earnings_date":""},"analyst":{"consensus":"","num_analysts":0,"target_high":0.00,"target_median":0.00,"target_low":0.00,"implied_upside":"","recent_actions":[]},"news":[{"headline":"","sentiment":"bullish/bearish/neutral","date":"","impact":"high/medium/low"},{"headline":"","sentiment":"bullish/bearish/neutral","date":"","impact":"high/medium/low"},{"headline":"","sentiment":"bullish/bearish/neutral","date":"","impact":"high/medium/low"}],"investments":[],"risks":[],"catalysts":[],"assessment":{"signal":"BUY/HOLD/WATCH/SELL","conviction":"high/medium/low","suggested_buy_zone":0.00,"suggested_sell_zone":0.00,"summary":""}}`;

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
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();

    let text = '';
    if (data.content) {
      for (const block of data.content) {
        if (block.type === 'text') text += block.text;
      }
    }

    text = text.trim()
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');

    if (first === -1 || last === -1 || last <= first) {
      return res.status(500).json({ error: 'Could not parse response' });
    }

    try {
      const parsed = JSON.parse(text.substring(first, last + 1));
      return res.status(200).json(parsed);
    } catch(e) {
      return res.status(500).json({ error: 'JSON parse failed' });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
