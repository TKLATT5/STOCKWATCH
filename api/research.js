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

    const prompt = `Research ${ticker} stock today using web search. Return ONLY valid JSON, no other text:
{"ticker":"${ticker}","name":"","sector":"","exchange":"","description":"","price":{"current":0,"prev_close":0,"week52_high":0,"week52_low":0,"market_cap":"","volume":""},"technicals":{"sma50":0,"sma200":0,"sma50_signal":"above","sma200_signal":"above","rsi":0,"rsi_signal":"neutral","trend":"uptrend","support":0,"resistance":0},"valuation":{"pe_trailing":0,"pe_forward":0,"dividend_yield":"0%","beta":0},"earnings":{"latest_quarter":"","gaap_eps":0,"non_gaap_eps":0,"gap_reason":"","revenue":"","revenue_growth":"","gross_margin":"","next_earnings_date":""},"analyst":{"consensus":"","num_analysts":0,"target_high":0,"target_median":0,"target_low":0,"implied_upside":"","recent_actions":[]},"news":[{"headline":"","sentiment":"neutral","date":"","impact":"medium"}],"investments":[],"risks":[],"catalysts":[],"assessment":{"signal":"HOLD","conviction":"medium","suggested_buy_zone":0,"suggested_sell_zone":0,"summary":""}}`;

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
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    let text = '';
    if (data.content) {
      for (const block of data.content) {
        if (block.type === 'text') text += block.text;
      }
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Could not parse response' });

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
